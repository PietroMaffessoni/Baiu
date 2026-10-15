import { CATEGORY, OUT_CATEGORIES } from '@/data/categories';
import type { State } from '@/data/types';
import { dueItems, dueLabel } from '../bills';
import { computeFolego } from '../folego';
import { round2 } from '../ledger';
import { brl } from '../money';
import { balances, flowsIn } from '../summary';
import { buildAlerts, expenseGroups, normalize, recurring } from './insights';

/**
 * Respostas prontas, calculadas no aparelho. Valem no modo exemplo, sem
 * internet, sem a IA ligada ou quando a IA falha. Cobrem as perguntas mais
 * comuns com os números da própria pessoa.
 */
export type Intent =
  | 'saudacao'
  | 'obrigado'
  | 'resumo'
  | 'economizar'
  | 'reserva'
  | 'investir'
  | 'cartao'
  | 'contas'
  | 'assinaturas'
  | 'avisos'
  | 'folego'
  | 'ajuda';

const RULES: [Intent, RegExp][] = [
  ['avisos', /\b(aviso|alerta|notou|notificac)/],
  ['assinaturas', /\b(assinaturas?|streaming|netflix|spotify|disney|prime video|mensalidades?)\b/],
  ['cartao', /\b(cartao|fatura|rotativo|juros|divida|devendo|parcel|emprestimo|cheque especial|limite)/],
  ['reserva', /\b(reserva|emergencia|imprevisto|colchao)/],
  [
    'investir',
    /\b(invest|aplicar|aplicacao|tesouro|cdb|lci|lca|acoes|acao|fii|fundo|render|rendimento|poupanca|cdi|selic)/,
  ],
  [
    'contas',
    /\b(contas? (fixas?|de casa|que se repetem?)|fixas?|recorrentes?|luz|agua|gas|internet|aluguel|condominio|vencimentos?|boletos?)\b/,
  ],
  [
    'economizar',
    /\b(econom|gastar menos|cortar|reduzir|onde (eu )?(mais )?gast|gastei|gasto|sobrar|guardar dinheiro|no azul|apertad)/,
  ],
  ['folego', /\b(folego|nota|pontuacao|pilar|murcho|estufado|baiu (esta|ta))/],
  ['resumo', /\b(resumo|como (eu )?(estou|to|ta|vai)|meu mes|balanco|situacao|entrou|saldo)/],
  ['obrigado', /\b(obrigad|valeu|brigad|show|otimo|massa)\b/],
  ['saudacao', /^(oi|ola|opa|eai|e ai|bom dia|boa tarde|boa noite|hey|salve)\b/],
];

export function intentOf(question: string): Intent {
  const q = normalize(question);
  for (const [intent, re] of RULES) if (re.test(q)) return intent;
  return 'ajuda';
}

const monthRange = (now: Date, offset: number) => ({
  start: new Date(now.getFullYear(), now.getMonth() + offset, 1),
  end: new Date(now.getFullYear(), now.getMonth() + offset + 1, 1),
});

function topCategories(state: State, now: Date) {
  const cur = monthRange(now, 0);
  const prev = monthRange(now, -1);
  return OUT_CATEGORIES.map((c) => {
    let este = 0;
    let antes = 0;
    for (const t of state.txs) {
      if (t.kind !== 'saida' || t.category !== c) continue;
      const d = new Date(t.date);
      if (d >= cur.start && d < cur.end) este += t.amount;
      else if (d >= prev.start && d < prev.end) antes += t.amount;
    }
    return { cat: c, label: CATEGORY[c].label, este: round2(este), antes: round2(antes) };
  })
    .filter((c) => c.este > 0)
    .sort((a, b) => b.este - a.este);
}

const list = (items: string[]) => items.map((t) => `• ${t}`).join('\n');

export function answerLocally(question: string, state: State, now = new Date(), firstName?: string): string {
  const intent = intentOf(question);
  if (state.accounts.length === 0 && !['saudacao', 'obrigado', 'ajuda'].includes(intent)) {
    return 'Ainda não tenho números seus para olhar. Cadastre a conta onde seu dinheiro entra e registre alguns gastos. Depois disso eu consigo te dizer para onde o dinheiro está indo e onde dá para economizar.';
  }
  const f = computeFolego(state, now);
  const month = flowsIn(state, monthRange(now, 0));
  const b = balances(state);

  switch (intent) {
    case 'saudacao':
      return `Oi${firstName ? `, ${firstName}` : ''}! Estou de olho nas suas contas. Quer um resumo do mês ou saber onde dá para economizar?`;
    case 'obrigado':
      return 'Por nada! Sempre que quiser, é só chamar. Fico de olho nos seus gastos por aqui.';

    case 'resumo': {
      const sobra = round2(month.entradas - month.gastos);
      const linhas = [
        `Neste mês entrou ${brl(month.entradas)} e saiu ${brl(month.gastos)}.`,
        month.entradas > 0
          ? sobra >= 0
            ? `Até agora sobraram ${brl(sobra)}.`
            : `Os gastos passaram as entradas em ${brl(-sobra)}.`
          : 'Ainda não entrou nada registrado neste mês.',
        month.aportes > 0 ? `Você investiu ${brl(month.aportes)}.` : null,
        `Seu fôlego está em ${f.score} de 100: ${f.mood.label.toLowerCase()}.`,
        `Meu conselho agora: ${f.habit.text.charAt(0).toLowerCase()}${f.habit.text.slice(1)}`,
      ];
      return linhas.filter(Boolean).join(' ');
    }

    case 'economizar': {
      const cats = topCategories(state, now).slice(0, 3);
      const subiu = topCategories(state, now)
        .filter((c) => c.antes > 0 && c.este - c.antes >= 30)
        .sort((a, b) => b.este - b.antes - (a.este - a.antes))
        .slice(0, 2);
      const subs = recurring(state, now).filter((r) => r.kind === 'assinatura');
      const partes: string[] = [];
      if (cats.length) {
        partes.push(`Onde mais saiu dinheiro este mês:\n${list(cats.map((c) => `${c.label}: ${brl(c.este)}`))}`);
      }
      if (subiu.length) {
        partes.push(
          `Subiu em relação ao mês passado:\n${list(subiu.map((c) => `${c.label}: ${brl(c.este - c.antes)} a mais`))}`,
        );
      }
      const dicas = [
        cats[0] ? `Defina um teto para ${cats[0].label.toLowerCase()} e confira aqui no meio do mês.` : null,
        subs.length
          ? `Revise as assinaturas: ${subs.map((s) => s.label).join(', ')} somam ${brl(subs.reduce((n, s) => n + s.avg, 0))} por mês.`
          : null,
        'Separe o que vai guardar logo que o salário cair, antes de gastar.',
      ].filter((x): x is string => !!x);
      partes.push(`O que eu faria:\n${list(dicas)}`);
      return partes.join('\n\n');
    }

    case 'reserva': {
      const gasto = Math.max(f.summary.gastos, 1);
      const alvo = round2(gasto * 6);
      const falta = round2(Math.max(0, alvo - b.reserva));
      const ritmo = Math.max(50, Math.round((f.summary.entradas * 0.1) / 10) * 10);
      const meses = falta > 0 ? Math.ceil(falta / ritmo) : 0;
      return [
        `Sua reserva tem ${brl(b.reserva)} e cobre ${f.meses.toFixed(1).replace('.', ',')} ${f.meses >= 0.95 && f.meses < 1.05 ? 'mês' : 'meses'} dos seus gastos.`,
        falta > 0
          ? `O ideal é ter seis meses guardados, uns ${brl(alvo, { cents: false })}. Faltam ${brl(falta, { cents: false })}. Guardando ${brl(ritmo, { cents: false })} por mês, você chega lá em ${meses} ${meses === 1 ? 'mês' : 'meses'}.`
          : 'Você já tem seis meses guardados. Daqui para frente, o que sobrar pode ir para investimentos de prazo mais longo.',
        'Deixe a reserva num lugar seguro e que dá para sacar no mesmo dia, como o Tesouro Selic ou um CDB de liquidez diária que pague perto de 100% do CDI.',
      ].join(' ');
    }

    case 'investir': {
      const atrasos = f.atrasadas.length;
      const passos: string[] = [];
      if (atrasos > 0)
        passos.push('Primeiro, coloque os vencimentos atrasados em dia. Multa e juros comem qualquer rendimento.');
      if (b.fatura > 0 && b.saldo < b.fatura) {
        passos.push(
          'Garanta o pagamento total da fatura. Os juros do rotativo do cartão estão entre os mais altos do país.',
        );
      }
      if (f.meses < 3) {
        passos.push(
          `Monte a reserva de emergência antes de arriscar: hoje ela cobre ${f.meses.toFixed(1).replace('.', ',')} meses e o ideal é de três a seis, em Tesouro Selic ou CDB de liquidez diária.`,
        );
      }
      const taxa = f.summary.entradas > 0 ? f.summary.aportes / f.summary.entradas : 0;
      passos.push(
        `Invista todo mês, mesmo pouco. Nos últimos 30 dias você investiu ${Math.round(taxa * 100)}% do que entrou; a meta do fôlego é 15%.`,
      );
      if (f.meses >= 3) {
        passos.push(
          'Com a reserva pronta, pense no prazo de cada objetivo: para daqui a poucos anos, renda fixa como Tesouro IPCA+, CDB, LCI e LCA; para mais de cinco anos, dá para ter uma parte em fundos imobiliários, ações ou ETFs.',
        );
      }
      return `Do jeito que eu vejo, a ordem é esta:\n${passos.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nNão indico ativos específicos; isso é com um profissional certificado.`;
    }

    case 'cartao': {
      const cards = state.accounts.filter((a) => a.kind === 'cartao');
      if (cards.length === 0) {
        return 'Você não tem cartão cadastrado aqui. Se usar um, cadastre em Contas para eu acompanhar a fatura. E a regra de ouro: pague sempre a fatura inteira, porque o rotativo tem os juros mais altos do mercado.';
      }
      const fatura = dueItems(state, now).find((d) => d.kind === 'card');
      return [
        b.fatura > 0
          ? `Sua fatura em aberto está em ${brl(b.fatura)}${fatura ? ` e ${dueLabel(fatura.due, now).toLowerCase()}` : ''}.`
          : 'Nenhuma fatura em aberto agora.',
        b.fatura > b.saldo
          ? `Hoje o saldo das contas (${brl(b.saldo)}) não cobre a fatura. Segure as compras no cartão até lá.`
          : null,
        'Pague sempre o valor total. Se não der, um parcelamento da fatura ou um empréstimo pessoal costuma sair mais barato que o rotativo. Compare o custo efetivo total antes de aceitar.',
      ]
        .filter(Boolean)
        .join(' ');
    }

    case 'contas': {
      const rec = recurring(state, now).filter((r) => r.kind !== 'assinatura');
      const prox = dueItems(state, now).slice(0, 3);
      const partes: string[] = [];
      if (rec.length) {
        partes.push(`Contas que se repetem todo mês:\n${list(rec.map((r) => `${r.label}: média de ${brl(r.avg)}`))}`);
      } else {
        partes.push('Ainda não reconheci contas que se repetem. Elas aparecem depois de dois meses registrando.');
      }
      if (prox.length) {
        partes.push(
          `Próximos vencimentos:\n${list(prox.map((d) => `${d.title}: ${brl(d.amount)}, ${dueLabel(d.due, now).toLowerCase()}`))}`,
        );
      }
      const semLembrete = rec.filter((r) => !r.hasBill);
      if (semLembrete.length) {
        partes.push(
          `Cadastre ${semLembrete.map((r) => r.label.toLowerCase()).join(', ')} em Vencimentos que eu te lembro um dia antes.`,
        );
      }
      return partes.join('\n\n');
    }

    case 'assinaturas': {
      const subs = recurring(state, now).filter((r) => r.kind === 'assinatura');
      if (subs.length === 0) {
        return 'Não reconheci assinaturas ainda. Elas aparecem quando o mesmo gasto se repete por dois meses. Vale registrar streaming, academia e aplicativos para eu acompanhar.';
      }
      const total = subs.reduce((n, s) => n + s.avg, 0);
      return `Suas assinaturas:\n${list(subs.map((s) => `${s.label}: ${brl(s.avg)} por mês`))}\n\nSomam ${brl(total)} por mês, ${brl(total * 12, { cents: false })} por ano. Cancele o que você não usou nas últimas semanas; dá para assinar de novo quando quiser.`;
    }

    case 'avisos': {
      const alerts = buildAlerts(state, now);
      if (alerts.length === 0) return 'Nada fora do normal por enquanto. Se algum gasto disparar, eu aviso.';
      return `O que eu notei este mês:\n${list(alerts.map((a) => a.text))}`;
    }

    case 'folego':
      return `O fôlego vai de 0 a 100 e soma quatro pilares de 25 pontos. O seu está em ${f.score}:\n${list(
        f.pillars.map((p) => `${p.title}: ${Math.round(p.points)} de 25. ${p.detail}`),
      )}\n\n${f.habit.text}`;

    case 'ajuda':
    default: {
      const daily = expenseGroups(state, now).length > 0;
      return `Essa eu não sei responder com as respostas prontas. Posso te ajudar com:\n${list([
        'resumo do mês',
        'onde economizar',
        'reserva de emergência',
        'por onde começar a investir',
        'cartão e juros',
        'contas fixas e assinaturas',
        daily ? 'o que eu notei nos seus gastos' : 'como o fôlego funciona',
      ])}`;
    }
  }
}

/** Primeira fala do Baiu numa conversa nova. */
export function greetingText(firstName?: string, demo?: boolean) {
  const oi = `Oi${firstName ? `, ${firstName}` : ''}! Eu sou o Baiu.`;
  return demo
    ? `${oi} Aqui no exemplo eu respondo com dicas prontas, a partir dos dados de exemplo. Pergunte onde dá para economizar, como montar a reserva ou por onde começar a investir.`
    : `${oi} Fico de olho nos seus gastos, aviso quando algo foge do normal e respondo suas dúvidas sobre dinheiro: economizar, investir, sair das dívidas. Pode perguntar.`;
}

export const SUGGESTIONS = [
  'Resumo do meu mês',
  'Onde posso economizar?',
  'Como montar minha reserva?',
  'Por onde começo a investir?',
  'Como fugir dos juros do cartão?',
  'Minhas contas fixas',
  'Minhas assinaturas',
];
