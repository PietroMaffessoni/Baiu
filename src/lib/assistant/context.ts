import { CATEGORY, OUT_CATEGORIES } from '@/data/categories';
import type { State } from '@/data/types';
import { dueItems } from '../bills';
import { computeFolego } from '../folego';
import { round2 } from '../ledger';
import { balances, flowsIn } from '../summary';
import { buildAlerts, expenseGroups, recurring } from './insights';

/**
 * O resumo que vai junto com a pergunta para a IA (só com consentimento).
 * Minimização (LGPD, art. 6º, III): totais e médias, sem nome, e-mail,
 * celular, banco, apelido de conta, datas exatas ou movimentos um a um.
 * Rótulos de gastos só entram quando se repetem e passam pelo filtro abaixo.
 */
export type AssistantContext = {
  hoje: string;
  mes_atual: Flows & { dias_passados: number; dias_no_mes: number };
  mes_passado: Flows;
  mes_retrasado: Flows;
  gastos_por_categoria: { categoria: string; este_mes: number; mes_passado: number }[];
  gastos_do_dia_a_dia: { item: string; este_mes: number; mes_passado: number; vezes_este_mes: number }[];
  contas_que_se_repetem: { item: string; tipo: string; media_mensal: number; ultima: number; tem_lembrete: boolean }[];
  saldos: {
    contas_correntes: number;
    reserva: number;
    investido: number;
    fatura_cartao_em_aberto: number;
    limite_total_cartoes: number;
  };
  investimentos_por_tipo: { tipo: string; valor: number; aplicado: number }[];
  vencimentos_proximos_30_dias: { quantidade: number; total: number; atrasados: number };
  folego: { nota: number; estado: string; pilares: { nome: string; pontos: number; detalhe: string }[] };
  avisos: string[];
};

type Flows = { entradas: number; gastos: number; investido: number; guardado_na_reserva: number };

const monthRange = (now: Date, offset: number) => ({
  start: new Date(now.getFullYear(), now.getMonth() + offset, 1),
  end: new Date(now.getFullYear(), now.getMonth() + offset + 1, 1),
});

function flows(state: State, now: Date, offset: number): Flows {
  const f = flowsIn(state, monthRange(now, offset));
  return { entradas: f.entradas, gastos: f.gastos, investido: f.aportes, guardado_na_reserva: f.guardado };
}

/** Rótulo que pode sair do aparelho: sem números (documentos, contas), e-mails ou nomes de pessoas em Pix. */
export function safeLabel(label: string): string | null {
  const l = label.trim();
  if (!l || /\d|@/.test(l)) return null;
  // "Pix para João", "TED Maria": nome de gente não sai do aparelho
  if (/\b(pix|ted|doc|transf\w*)\b/i.test(l)) return null;
  return l.slice(0, 30);
}

export function buildContext(state: State, now = new Date()): AssistantContext {
  const cur = monthRange(now, 0);
  const prev = monthRange(now, -1);
  const inR = (d: string, r: { start: Date; end: Date }) => {
    const x = new Date(d);
    return x >= r.start && x < r.end;
  };

  const byCat = OUT_CATEGORIES.map((c) => {
    let este = 0;
    let passado = 0;
    for (const t of state.txs) {
      if (t.kind !== 'saida' || t.category !== c) continue;
      if (inR(t.date, cur)) este += t.amount;
      else if (inR(t.date, prev)) passado += t.amount;
    }
    return { categoria: CATEGORY[c].label, este_mes: round2(este), mes_passado: round2(passado) };
  })
    .filter((c) => c.este_mes > 0 || c.mes_passado > 0)
    .sort((a, b) => b.este_mes - a.este_mes)
    .slice(0, 10);

  const groups = expenseGroups(state, now);
  const rec = recurring(state, now, groups);
  const recKeys = new Set(rec.map((r) => r.key));
  const ci = now.getFullYear() * 12 + now.getMonth();
  const daily = groups
    .filter((g) => !recKeys.has(g.key) && !g.kind && g.txs.length >= 2)
    .map((g) => ({
      item: safeLabel(g.label),
      este_mes: g.months.get(ci)?.total ?? 0,
      mes_passado: g.months.get(ci - 1)?.total ?? 0,
      vezes_este_mes: g.months.get(ci)?.count ?? 0,
    }))
    .filter((g): g is typeof g & { item: string } => !!g.item && g.este_mes + g.mes_passado > 0)
    .sort((a, b) => b.este_mes - a.este_mes)
    .slice(0, 8);

  const b = balances(state);
  const kinds = new Map<string, { valor: number; aplicado: number }>();
  for (const h of state.holdings) {
    const k = kinds.get(h.kind) ?? { valor: 0, aplicado: 0 };
    k.valor = round2(k.valor + h.value);
    k.aplicado = round2(k.aplicado + h.invested);
    kinds.set(h.kind, k);
  }

  const soon = dueItems(state, now).filter((d) => d.overdue || d.due.getTime() - now.getTime() < 30 * 86_400_000);
  const folego = computeFolego(state, now);

  return {
    hoje: now.toISOString().slice(0, 10),
    mes_atual: {
      ...flows(state, now, 0),
      dias_passados: now.getDate(),
      dias_no_mes: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    },
    mes_passado: flows(state, now, -1),
    mes_retrasado: flows(state, now, -2),
    gastos_por_categoria: byCat,
    gastos_do_dia_a_dia: daily,
    contas_que_se_repetem: rec
      .map((r) => ({
        item: safeLabel(r.label),
        tipo: r.kind === 'assinatura' ? 'assinatura' : r.kind === 'conta' ? 'conta de consumo' : 'gasto fixo',
        media_mensal: r.avg,
        ultima: r.last,
        tem_lembrete: r.hasBill,
      }))
      .filter((r): r is typeof r & { item: string } => !!r.item)
      .slice(0, 12),
    saldos: {
      contas_correntes: b.corrente,
      reserva: b.reserva,
      investido: b.investido,
      fatura_cartao_em_aberto: b.fatura,
      limite_total_cartoes: round2(
        state.accounts.filter((a) => a.kind === 'cartao').reduce((n, a) => n + (a.limit ?? 0), 0),
      ),
    },
    investimentos_por_tipo: [...kinds].map(([tipo, v]) => ({ tipo, ...v })),
    vencimentos_proximos_30_dias: {
      quantidade: soon.length,
      total: round2(soon.reduce((n, d) => n + d.amount, 0)),
      atrasados: soon.filter((d) => d.overdue).length,
    },
    folego: {
      nota: folego.score,
      estado: folego.mood.label,
      pilares: folego.pillars.map((p) => ({ nome: p.title, pontos: Math.round(p.points), detalhe: p.detail })),
    },
    avisos: buildAlerts(state, now).map((a) => a.text),
  };
}

/** O mesmo resumo em frases, para a pessoa ver exatamente o que é enviado. */
export function describeContext(c: AssistantContext): { title: string; lines: string[] }[] {
  const n = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const month = (label: string, f: Flows) =>
    `${label}: entrou ${n(f.entradas)}, saiu ${n(f.gastos)}, investiu ${n(f.investido)}, guardou ${n(f.guardado_na_reserva)}`;
  return [
    {
      title: 'Meses',
      lines: [
        month('Este mês', c.mes_atual),
        month('Mês passado', c.mes_passado),
        month('Mês retrasado', c.mes_retrasado),
      ],
    },
    {
      title: 'Gastos por categoria',
      lines: c.gastos_por_categoria.map((g) => `${g.categoria}: ${n(g.este_mes)} (mês passado ${n(g.mes_passado)})`),
    },
    {
      title: 'Gastos do dia a dia que se repetem',
      lines: c.gastos_do_dia_a_dia.map(
        (g) => `${g.item}: ${n(g.este_mes)} em ${g.vezes_este_mes}x (mês passado ${n(g.mes_passado)})`,
      ),
    },
    {
      title: 'Contas que se repetem',
      lines: c.contas_que_se_repetem.map((r) => `${r.item}, ${r.tipo}: média de ${n(r.media_mensal)} por mês`),
    },
    {
      title: 'Saldos somados',
      lines: [
        `Contas correntes: ${n(c.saldos.contas_correntes)}`,
        `Reserva: ${n(c.saldos.reserva)}`,
        `Investido: ${n(c.saldos.investido)}`,
        `Fatura em aberto: ${n(c.saldos.fatura_cartao_em_aberto)}`,
        `Limite dos cartões: ${n(c.saldos.limite_total_cartoes)}`,
      ],
    },
    {
      title: 'Investimentos por tipo',
      lines: c.investimentos_por_tipo.map((i) => `${i.tipo}: ${n(i.valor)} (aplicado ${n(i.aplicado)})`),
    },
    {
      title: 'Vencimentos e fôlego',
      lines: [
        `${c.vencimentos_proximos_30_dias.quantidade} vencimentos nos próximos 30 dias, somando ${n(c.vencimentos_proximos_30_dias.total)}; ${c.vencimentos_proximos_30_dias.atrasados} atrasados`,
        `Fôlego ${c.folego.nota} de 100 (${c.folego.estado.toLowerCase()})`,
      ],
    },
  ].filter((s) => s.lines.length > 0);
}
