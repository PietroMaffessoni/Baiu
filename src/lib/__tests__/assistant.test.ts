/* eslint-disable @typescript-eslint/no-require-imports -- o mock do AsyncStorage vem por require */
import { createDemo, createEmpty } from '@/data/demo';
import type { Account, Bill, ChatMsg, State, Tx } from '@/data/types';
import { CHAT_LIMIT, reducer } from '@/store/reducer';
import { buildContext, describeContext, safeLabel } from '../assistant/context';
import { buildAlerts, expenseGroups, groupKey, recurring, unseenAlerts } from '../assistant/insights';
import { answerLocally, intentOf } from '../assistant/local';
import { digestBody, nextSlot } from '../assistant/digest';
import { AssistantFailure, createFakeAssistant, toApiMessages } from '../assistant/remote';
import { cleanReply, maskValues } from '../assistant/text';
import { migrate } from '../migrate';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1 }));

const NOW = new Date(2026, 9, 15, 12); // 15 de outubro de 2026
const on = (monthsAgo: number, day: number, hour = 12) =>
  new Date(NOW.getFullYear(), NOW.getMonth() - monthsAgo, day, hour).toISOString();

let n = 0;
const tx = (date: string, description: string, amount: number, p: Partial<Tx> = {}): Tx => ({
  id: `t${++n}`,
  kind: 'saida',
  accountId: 'c',
  amount,
  description,
  category: 'alimentacao',
  method: 'pix',
  date,
  createdAt: date,
  ...p,
});

const acc = (id: string, kind: Account['kind'], balance: number, extra: Partial<Account> = {}): Account => ({
  id,
  bankId: 'nubank',
  kind,
  balance,
  createdAt: on(6, 1),
  ...extra,
});

function base(txs: Tx[], bills: Bill[] = []): State {
  return {
    ...createEmpty(NOW),
    onboarded: true,
    accounts: [
      acc('c', 'corrente', 3000, { nickname: 'Conta da Ana' }),
      acc('r', 'reserva', 5000),
      acc('k', 'cartao', 800, { limit: 4000, dueDay: 20 }),
    ],
    txs,
    bills,
  };
}

const utilities = () =>
  [3, 2, 1].flatMap((m) => [
    tx(on(m, 6), 'Conta de luz Enel', [115, 120, 118][3 - m], { category: 'contas', method: 'boleto' }),
    tx(on(m, 9), 'Comgás', 90, { category: 'contas', method: 'boleto' }),
    tx(on(m, 3), 'Netflix', 39.9, { category: 'assinaturas', method: 'cartao' }),
    tx(on(m, 4), 'Salário', 5000, { kind: 'entrada', category: 'salario', method: 'ted' }),
  ]);

describe('agrupamento dos gastos', () => {
  it('reconhece contas de consumo pelo nome da empresa', () => {
    expect(groupKey('Conta de luz Enel', 'contas')?.key).toBe('f:luz');
    expect(groupKey('CEMIG 10/2026', 'contas')?.key).toBe('f:luz');
    expect(groupKey('Sabesp', 'contas')?.key).toBe('f:agua');
    expect(groupKey('Ultragaz botijão', 'casa')?.key).toBe('f:gas');
    expect(groupKey('Internet Vivo', 'contas')?.key).toBe('f:internet');
  });

  it('não confunde gasolina com gás', () => {
    expect(groupKey('Posto gasolina', 'transporte')?.key).toBe('transporte:posto');
  });

  it('junta "Açaí do Zé" e "Açaí Concept" num grupo genérico', () => {
    const groups = expenseGroups(base([tx(on(0, 2), 'Açaí do Zé', 20), tx(on(0, 5), 'Açaí Concept', 25)]), NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ label: 'Açaí', generic: true });
  });

  it('mantém o nome quando é sempre o mesmo', () => {
    const groups = expenseGroups(base([tx(on(0, 2), 'iFood', 20), tx(on(0, 5), 'iFood', 25)]), NOW);
    expect(groups[0]).toMatchObject({ label: 'iFood', generic: false });
  });

  it('ignora entradas e transferências', () => {
    const groups = expenseGroups(
      base([
        tx(on(0, 2), 'Pix de Ana Souza', 100, { kind: 'entrada', category: 'reembolso' }),
        tx(on(0, 3), 'Para a reserva', 300, { kind: 'transferencia', category: 'transferencia', toAccountId: 'r' }),
      ]),
      NOW,
    );
    expect(groups).toHaveLength(0);
  });
});

describe('contas que se repetem', () => {
  it('reconhece luz, gás e assinatura a partir de dois meses', () => {
    const rec = recurring(base(utilities()), NOW);
    const keys = rec.map((r) => `${r.key}:${r.kind}`);
    expect(keys).toEqual(expect.arrayContaining(['f:luz:conta', 'f:gas:conta', 'assinaturas:netflix:assinatura']));
    expect(rec.find((r) => r.key === 'f:luz')).toMatchObject({ label: 'Conta de luz', day: 6, seen: 3 });
  });

  it('mercado e delivery uma vez por mês não viram assinatura', () => {
    const txs = [3, 2, 1, 0].flatMap((m) => [
      tx(on(m, 8), 'Mercado Extra', 400 + m, { category: 'mercado' }),
      tx(on(m, 9), 'iFood', 52.4),
      tx(on(m, 5), 'Escola Aurora', 980, { category: 'educacao' }),
    ]);
    const rec = recurring(base(txs), NOW);
    expect(rec.map((r) => `${r.label}:${r.kind}`)).toEqual(['Escola Aurora:fixo']);
  });

  it('gasto do dia a dia não vira conta fixa', () => {
    const txs = [3, 2, 1, 0].flatMap((m) => [
      tx(on(m, 2), 'iFood', 30),
      tx(on(m, 9), 'iFood', 55),
      tx(on(m, 12), 'iFood', 18),
    ]);
    expect(recurring(base(txs), NOW)).toHaveLength(0);
  });

  it('sabe quando já existe um vencimento cadastrado', () => {
    const bill: Bill = {
      id: 'b1',
      title: 'Luz',
      amount: 120,
      dueDate: on(-1, 6),
      category: 'contas',
      repeatMonthly: true,
      paid: false,
      createdAt: on(1, 1),
    };
    const rec = recurring(base(utilities(), [bill]), NOW);
    expect(rec.find((r) => r.key === 'f:luz')?.hasBill).toBe(true);
    expect(rec.find((r) => r.key === 'f:gas')?.hasBill).toBe(false);
  });
});

describe('avisos', () => {
  it('"você gastou R$ 50 a mais com açaí do que no mês passado"', () => {
    const s = base([
      tx(on(1, 1), 'Padaria', 10),
      tx(on(1, 3), 'Açaí do Zé', 30),
      tx(on(1, 20), 'Açaí Concept', 25),
      tx(on(0, 2), 'Açaí do Zé', 35),
      tx(on(0, 6), 'Açaí do Zé', 40),
      tx(on(0, 11), 'Açaí Concept', 30),
    ]);
    const a = buildAlerts(s, NOW).find((x) => x.kind === 'item');
    expect(a?.text).toBe(
      'Este mês você já gastou R$ 50,00 a mais com açaí do que no mês passado inteiro: R$ 105,00 até agora, contra R$ 55,00.',
    );
    expect(a?.push).not.toMatch(/R\$/);
    expect(a?.ask).toBe('Como posso gastar menos com açaí?');
  });

  it('quem começou a registrar no meio do mês passado não recebe comparação injusta', () => {
    const s = base([tx(on(1, 25), 'Açaí', 15), tx(on(0, 2), 'Açaí', 40), tx(on(0, 6), 'Açaí', 40)]);
    expect(buildAlerts(s, NOW).filter((x) => x.kind === 'item' || x.kind === 'ritmo')).toHaveLength(0);
  });

  it('diferença pequena não vira aviso', () => {
    const s = base([tx(on(1, 3), 'Açaí', 50), tx(on(0, 2), 'Açaí', 30), tx(on(0, 6), 'Açaí', 30)]);
    expect(buildAlerts(s, NOW).filter((x) => x.kind === 'item')).toHaveLength(0);
  });

  it('conta de luz acima da média dos meses anteriores', () => {
    const s = base([...utilities(), tx(on(0, 6), 'Conta de luz Enel', 160, { category: 'contas' })]);
    const a = buildAlerts(s, NOW).find((x) => x.id.startsWith('conta:f:luz'));
    expect(a?.text).toContain('Conta de luz deste mês veio R$ 42,33 acima da média');
    expect(a?.push).toBe('Conta de luz deste mês veio acima da média.');
  });

  it('assinatura que ficou mais cara', () => {
    const s = base([...utilities(), tx(on(0, 3), 'Netflix', 44.9, { category: 'assinaturas' })]);
    const a = buildAlerts(s, NOW).find((x) => x.id.startsWith('conta:assinaturas:netflix'));
    expect(a?.text).toBe('Netflix subiu de R$ 39,90 para R$ 44,90 este mês. Em um ano, são R$ 60,00 a mais.');
  });

  it('conta que se repete sem lembrete vira sugestão de vencimento', () => {
    const a = buildAlerts(base(utilities()), NOW).find((x) => x.id === 'recorrente:f:gas');
    expect(a?.bill).toEqual({ title: 'Conta de gás', amount: 90, category: 'contas', day: 9 });
  });

  it('gastos chegando perto do que entrou no mês', () => {
    const s = base([
      tx(on(0, 2), 'Salário', 3000, { kind: 'entrada', category: 'salario' }),
      tx(on(0, 5), 'Aluguel', 1800, { category: 'casa' }),
      tx(on(0, 8), 'Mercado', 1000, { category: 'mercado' }),
    ]);
    const a = buildAlerts(s, NOW).find((x) => x.kind === 'ritmo');
    expect(a?.id).toBe('ritmo:entradas:2026-10');
    expect(a?.text).toContain('93% do que entrou');
    expect(a?.text).toContain('Ainda faltam 16 dias');
  });

  it('categoria que acelerou, sem contar contas fixas', () => {
    const s = base([
      tx(on(1, 1), 'Farmácia', 20, { category: 'saude' }),
      tx(on(1, 3), 'Padaria', 40, { category: 'alimentacao' }),
      tx(on(1, 8), 'Restaurante', 60, { category: 'alimentacao' }),
      tx(on(0, 3), 'Restaurante Coco', 120, { category: 'alimentacao' }),
      tx(on(0, 7), 'Pizzaria', 90, { category: 'alimentacao' }),
      tx(on(0, 12), 'Hamburgueria', 70, { category: 'alimentacao' }),
    ]);
    const a = buildAlerts(s, NOW).find((x) => x.kind === 'categoria');
    expect(a?.id).toBe('categoria:alimentacao:2026-10');
    expect(a?.text).toContain('R$ 180,00 a mais do que até o dia 15 do mês passado');
  });

  it('sem dados, nenhum aviso', () => {
    expect(buildAlerts(createEmpty(NOW), NOW)).toHaveLength(0);
  });

  it('aviso visto não volta', () => {
    let s = base(utilities());
    const first = unseenAlerts(s, NOW);
    expect(first.length).toBeGreaterThan(0);
    s = reducer(s, { type: 'alertsSeen', ids: first.map((a) => a.id) });
    expect(unseenAlerts(s, NOW)).toHaveLength(0);
  });

  it('o exemplo mostra o que o Baiu sabe fazer', () => {
    const demo = createDemo(NOW);
    const ids = buildAlerts(demo, NOW).map((a) => a.id);
    for (const prefix of ['item:alimentacao:acai', 'recorrente:f:gas', 'conta:f:luz', 'conta:assinaturas:netflix']) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(true);
    }
  });
});

describe('resumo enviado à IA (minimização)', () => {
  const s = base([
    ...utilities(),
    tx(on(0, 2), 'Pix para João Pereira', 200, { category: 'outros' }),
    tx(on(0, 5), 'Pix para João Pereira', 150, { category: 'outros' }),
    tx(on(0, 3), 'Pix de Ana Souza', 90, { kind: 'entrada', category: 'reembolso' }),
    tx(on(0, 4), 'Boleto 123456789', 80, { category: 'outros' }),
    tx(on(0, 6), 'Boleto 123456789', 80, { category: 'outros' }),
  ]);
  const ctx = buildContext(s, NOW);
  const raw = JSON.stringify(ctx);

  it('não leva nomes de pessoas, apelidos de contas, bancos ou números de documento', () => {
    for (const secret of ['João', 'Ana Souza', 'Conta da Ana', 'nubank', 'Nubank', '123456789']) {
      expect(raw).not.toContain(secret);
    }
  });

  it('não leva ids nem datas exatas dos movimentos', () => {
    expect(raw).not.toMatch(/"t\d+"/);
    expect(raw).not.toMatch(/T\d{2}:\d{2}/);
  });

  it('leva totais do mês, contas que se repetem e saldos somados', () => {
    expect(ctx.mes_passado.entradas).toBe(5000);
    expect(ctx.contas_que_se_repetem.map((r) => r.item)).toEqual(expect.arrayContaining(['Conta de luz', 'Netflix']));
    expect(ctx.saldos).toMatchObject({
      contas_correntes: 3000,
      reserva: 5000,
      fatura_cartao_em_aberto: 800,
      limite_total_cartoes: 4000,
    });
  });

  it('o resumo em frases mostra o mesmo conteúdo', () => {
    const titles = describeContext(ctx).map((x) => x.title);
    expect(titles).toEqual(expect.arrayContaining(['Meses', 'Saldos somados', 'Contas que se repetem']));
  });

  it('filtro de rótulos', () => {
    expect(safeLabel('Pão de Açúcar')).toBe('Pão de Açúcar');
    expect(safeLabel('Pix Maria')).toBeNull();
    expect(safeLabel('TED João')).toBeNull();
    expect(safeLabel('Fatura 4432')).toBeNull();
    expect(safeLabel('ana@mail.com')).toBeNull();
  });
});

describe('respostas prontas', () => {
  it.each([
    ['Onde posso economizar?', 'economizar'],
    ['Onde eu mais gastei este mês?', 'economizar'],
    ['Como montar minha reserva?', 'reserva'],
    ['Por onde começo a investir?', 'investir'],
    ['Vale a pena o Tesouro Selic?', 'investir'],
    ['Como fugir dos juros do cartão?', 'cartao'],
    ['Minhas contas fixas', 'contas'],
    ['Minhas assinaturas', 'assinaturas'],
    ['Resumo do meu mês', 'resumo'],
    ['oi', 'saudacao'],
    ['valeu!', 'obrigado'],
    ['qual a capital da França?', 'ajuda'],
  ])('"%s" -> %s', (q, intent) => {
    expect(intentOf(q)).toBe(intent);
  });

  it('respostas usam os números da pessoa', () => {
    const demo = createDemo(NOW);
    expect(answerLocally('Resumo do meu mês', demo, NOW)).toMatch(/Neste mês entrou R\$/);
    expect(answerLocally('Como montar minha reserva?', demo, NOW)).toMatch(/Sua reserva tem R\$ 9\.800,00/);
    expect(answerLocally('Minhas assinaturas', demo, NOW)).toContain('Netflix');
    expect(answerLocally('Minhas contas fixas', demo, NOW)).toContain('Conta de gás');
    expect(answerLocally('Por onde começo a investir?', demo, NOW)).toContain('Não indico ativos específicos');
  });

  it('sem contas, pede para cadastrar antes', () => {
    expect(answerLocally('Onde posso economizar?', createEmpty(NOW), NOW)).toMatch(/Cadastre a conta/);
  });

  it('todas as respostas saem sem erro, com e sem dados', () => {
    const qs = [
      'oi',
      'obrigado',
      'resumo',
      'economizar',
      'reserva',
      'investir',
      'cartão',
      'contas fixas',
      'assinaturas',
      'avisos',
      'fôlego',
      'xyz',
    ];
    for (const st of [createDemo(NOW), base(utilities()), createEmpty(NOW)]) {
      for (const q of qs) expect(answerLocally(q, st, NOW).length).toBeGreaterThan(20);
    }
  });
});

describe('conversa', () => {
  const m = (role: ChatMsg['role'], text: string): ChatMsg => ({ id: `m${++n}`, role, text, at: NOW.toISOString() });

  it('histórico para a API começa e termina com a pessoa e alterna papéis', () => {
    const out = toApiMessages([
      m('baiu', 'aviso'),
      m('user', 'oi'),
      m('user', 'e aí?'),
      m('baiu', 'olá'),
      m('user', 'quanto gastei?'),
    ]);
    expect(out.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    expect(out[0].content).toBe('oi\n\ne aí?');
  });

  it('esconde valores quando "Ocultar valores" está ligado', () => {
    expect(maskValues('Gastou R$ 50,00 a mais, −R$ 1.234,56 no total')).toBe('Gastou R$ •••• a mais, R$ •••• no total');
  });

  it('limpa markdown da IA', () => {
    expect(cleanReply('## Dica\n**Guarde** 10%\n- item\n\n\n\nfim')).toBe('Dica\nGuarde 10%\n• item\n\nfim');
  });

  it('IA de teste: exige consentimento e respeita o limite', async () => {
    const ai = createFakeAssistant({ limit: 1 });
    const input = { messages: [{ role: 'user' as const, content: 'oi' }], context: null };
    await expect(ai.ask(input)).rejects.toEqual(new AssistantFailure('consent'));
    await ai.consent(true);
    await expect(ai.ask(input)).resolves.toMatchObject({ text: expect.stringContaining('sem os seus números') });
    await expect(ai.ask(input)).rejects.toEqual(new AssistantFailure('quota'));
  });

  it('IA de teste: sem internet', async () => {
    const ai = createFakeAssistant({ offline: () => true });
    await expect(ai.consent(true)).rejects.toEqual(new AssistantFailure('network'));
  });
});

describe('estado do assistente', () => {
  const msg = (i: number): ChatMsg => ({
    id: `m${i}`,
    role: i % 2 ? 'user' : 'baiu',
    text: `fala ${i}`,
    at: NOW.toISOString(),
  });

  it('guarda a conversa até o limite e marca a apresentação como vista', () => {
    let s = createEmpty(NOW);
    s = reducer(s, { type: 'chatAdd', msgs: Array.from({ length: CHAT_LIMIT + 10 }, (_, i) => msg(i)) });
    expect(s.assistant.chat).toHaveLength(CHAT_LIMIT);
    expect(s.assistant.chat[0].id).toBe('m10');
    expect(s.assistant.greeted).toBe(true);
    expect(reducer(s, { type: 'chatClear' }).assistant.chat).toHaveLength(0);
  });

  it('recusa falas vazias', () => {
    const s = createEmpty(NOW);
    expect(reducer(s, { type: 'chatAdd', msgs: [{ ...msg(1), text: '  ' }] })).toBe(s);
  });

  it('avisos vistos entram na conversa uma vez só', () => {
    let s = createEmpty(NOW);
    s = reducer(s, { type: 'alertsSeen', ids: ['a'], toChat: [{ ...msg(0), source: 'aviso' }] });
    s = reducer(s, { type: 'alertsSeen', ids: ['a'], toChat: [{ ...msg(2), source: 'aviso' }] });
    expect(s.assistant.chat).toHaveLength(1);
    expect(Object.keys(s.assistant.seen)).toEqual(['a']);
  });

  it('consentimento liga e desliga', () => {
    let s = createEmpty(NOW);
    s = reducer(s, { type: 'setAssistant', patch: { consent: { version: '2026-10-15', at: NOW.toISOString() } } });
    expect(s.assistant.consent?.version).toBe('2026-10-15');
    s = reducer(s, { type: 'setAssistant', patch: { consent: null, pendingRevoke: true } });
    expect(s.assistant).toMatchObject({ consent: null, pendingRevoke: true });
  });

  it('sair do exemplo não leva a conversa junto', () => {
    let s = reducer(createEmpty(NOW), { type: 'loadDemo' });
    s = reducer(s, { type: 'chatAdd', msgs: [msg(1)] });
    expect(reducer(s, { type: 'exitDemo' }).assistant.chat).toHaveLength(0);
  });

  it('dados antigos ganham o assistente com valores padrão', () => {
    const old = { ...createEmpty(NOW) } as Partial<State>;
    delete old.assistant;
    const s = migrate(old)!;
    expect(s.assistant).toMatchObject({ consent: null, shareNumbers: true, chat: [], greeted: false });
    expect(s.settings.alerts).toBe(true);
  });

  it('dados corrompidos do assistente são descartados sem quebrar', () => {
    const s = migrate({
      ...createEmpty(NOW),
      assistant: { chat: [{ id: 1 }, null], seen: 'x', consent: { version: 3 } },
    })!;
    expect(s.assistant).toMatchObject({ chat: [], seen: {}, consent: null });
  });
});

describe('notificação dos avisos', () => {
  it('fica entre 10h e 20h, pelo menos duas horas depois', () => {
    expect(nextSlot(new Date(2026, 9, 15, 7)).getHours()).toBe(10);
    expect(nextSlot(new Date(2026, 9, 15, 13, 30)).getHours()).toBe(15);
    const late = nextSlot(new Date(2026, 9, 15, 19));
    expect([late.getDate(), late.getHours()]).toEqual([16, 10]);
  });

  it('o texto nunca mostra valores', () => {
    const alerts = buildAlerts(createDemo(NOW), NOW);
    expect(digestBody(alerts)).not.toMatch(/R\$|\d+,\d{2}/);
    expect(digestBody(alerts.slice(0, 1))).toMatch(/Toque para conversar/);
  });
});
