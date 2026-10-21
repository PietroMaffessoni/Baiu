import { addDays, startOfDay } from '@/lib/dates';
import { DEFAULT_LOOK } from '@/lib/look';
import type { Account, Assistant, Bank, Bill, Holding, State, Tx } from './types';

export const DEFAULT_SETTINGS = { hideValues: false, lock: false, reminders: true, alerts: true, trialReminder: true };

export function createBank(): Bank {
  return { items: [], ignored: {}, hiddenAccounts: {}, rules: {} };
}

export function createAssistant(): Assistant {
  return {
    consent: null,
    declined: false,
    pendingRevoke: false,
    shareNumbers: true,
    greeted: false,
    chat: [],
    seen: {},
    notified: {},
  };
}

/** Estado de quem acabou de instalar: nada cadastrado. */
export function createEmpty(now = new Date()): State {
  return {
    version: 2,
    onboarded: false,
    demo: false,
    settings: { ...DEFAULT_SETTINGS },
    baiu: { ...DEFAULT_LOOK },
    assistant: createAssistant(),
    bank: createBank(),
    accounts: [],
    txs: [],
    bills: [],
    holdings: [],
    seals: {},
    createdAt: now.toISOString(),
  };
}

/**
 * Dados de exemplo. Tudo aqui é sintético e ancorado na data em que foram
 * carregados, para o mês sempre parecer vivo.
 */
export function createDemo(now = new Date()): State {
  const today = startOfDay(now);
  const at = (daysAgo: number, hour = 12) => {
    const d = addDays(today, -daysAgo);
    d.setHours(hour, (daysAgo * 17) % 60);
    return d.toISOString();
  };

  const accounts: Account[] = [
    { id: 'a-nu', bankId: 'nubank', kind: 'corrente', balance: 4218.4, createdAt: at(200) },
    { id: 'a-itau', bankId: 'itau', kind: 'corrente', nickname: 'Salário', balance: 1932.15, createdAt: at(400) },
    { id: 'a-inter', bankId: 'inter', kind: 'corrente', nickname: 'Freelas', balance: 612.8, createdAt: at(120) },
    {
      id: 'a-caixa',
      bankId: 'caixa',
      kind: 'reserva',
      nickname: 'Reserva de emergência',
      balance: 9800,
      createdAt: at(380),
    },
    { id: 'a-xp', bankId: 'xp', kind: 'investimento', balance: 0, createdAt: at(370) },
    {
      id: 'a-nucard',
      bankId: 'nubank',
      kind: 'cartao',
      balance: 1284.6,
      dueDay: addDays(today, 7).getDate(),
      limit: 6500,
      createdAt: at(200),
    },
  ];

  let n = 0;
  const out = (
    daysAgo: number,
    hour: number,
    accountId: string,
    description: string,
    amount: number,
    category: Tx['category'],
    method?: Tx['method'],
  ): Tx => ({
    id: `t${++n}`,
    kind: 'saida',
    accountId,
    amount,
    description,
    category,
    method,
    date: at(daysAgo, hour),
    createdAt: at(daysAgo, hour),
  });
  const inn = (
    daysAgo: number,
    hour: number,
    accountId: string,
    description: string,
    amount: number,
    category: Tx['category'],
    method?: Tx['method'],
  ): Tx => ({
    ...out(daysAgo, hour, accountId, description, amount, category, method),
    kind: 'entrada',
  });
  const move = (daysAgo: number, hour: number, from: string, to: string, description: string, amount: number): Tx => ({
    ...out(daysAgo, hour, from, description, amount, 'transferencia', 'pix'),
    kind: 'transferencia',
    toAccountId: to,
  });

  const txs: Tx[] = [
    out(0, 13, 'a-nucard', 'iFood', 46.9, 'alimentacao', 'cartao'),
    inn(0, 9, 'a-nu', 'Pix de Ana Souza', 120, 'reembolso', 'pix'),
    out(1, 19, 'a-nucard', 'Uber', 23.4, 'transporte', 'cartao'),
    out(1, 11, 'a-nu', 'Pão de Açúcar', 187.35, 'mercado', 'debito'),
    out(2, 8, 'a-nucard', 'Spotify', 21.9, 'assinaturas', 'cartao'),
    move(3, 10, 'a-nu', 'a-xp', 'Aporte do mês', 800),
    out(3, 9, 'a-itau', 'Conta de luz Enel', 142.8, 'contas', 'boleto'),
    out(4, 18, 'a-nucard', 'Drogasil', 58.2, 'saude', 'cartao'),
    out(5, 20, 'a-nucard', 'Restaurante Coco Bambu', 168, 'lazer', 'cartao'),
    out(5, 8, 'a-nu', 'Posto Shell', 150, 'transporte', 'debito'),
    out(6, 10, 'a-itau', 'Aluguel', 1850, 'casa', 'pix'),
    out(6, 15, 'a-nucard', 'Curso de inglês', 297, 'educacao', 'cartao'),
    out(7, 21, 'a-nucard', 'Netflix', 44.9, 'assinaturas', 'cartao'),
    inn(8, 9, 'a-itau', 'Salário', 6200, 'salario', 'ted'),
    move(8, 10, 'a-itau', 'a-caixa', 'Para a reserva', 600),
    out(9, 7, 'a-nu', 'Padaria Real', 18.5, 'alimentacao', 'debito'),
    out(9, 17, 'a-nu', 'Oficina do Zé', 640, 'transporte', 'pix'),
    inn(10, 15, 'a-inter', 'Freela de design', 950, 'renda_extra', 'pix'),
    move(10, 16, 'a-nu', 'a-nucard', 'Pagamento da fatura', 1640.22),
    out(11, 14, 'a-nucard', 'Mercado Livre', 239.9, 'compras', 'cartao'),
    out(11, 18, 'a-nu', 'Mercado Extra', 412.3, 'mercado', 'debito'),
    out(12, 6, 'a-nu', 'Academia Smart Fit', 99.9, 'saude', 'debito'),
    out(12, 9, 'a-itau', 'Internet Vivo', 119.99, 'contas', 'boleto'),
    out(13, 19, 'a-nucard', 'Presente de aniversário', 180, 'compras', 'cartao'),
    inn(13, 8, 'a-caixa', 'Rendimento da poupança', 52.3, 'rendimento'),
  ];

  // aportes dos meses anteriores, para a constância ter história
  const aporteMonths = [1, 2, 3, 4, 6, 7, 8, 9, 11];
  for (const m of aporteMonths) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 8, 10);
    txs.push({
      id: `t${++n}`,
      kind: 'transferencia',
      accountId: 'a-nu',
      toAccountId: 'a-xp',
      amount: [800, 750, 800, 650, 700, 600, 500, 400, 400][aporteMonths.indexOf(m)],
      description: 'Aporte do mês',
      category: 'transferencia',
      method: 'pix',
      date: d.toISOString(),
      createdAt: d.toISOString(),
    });
  }

  // meses anteriores, presos ao calendário: o Baiu precisa de histórico para
  // reconhecer contas que se repetem e comparar com o mês passado.
  // No mês passado, só até o dia de hoje, para não mexer no fôlego (últimos 30 dias).
  const onMonth = (monthsAgo: number, day: number, hour = 12) => {
    const y = today.getFullYear();
    const m = today.getMonth() - monthsAgo;
    const last = new Date(y, m + 1, 0).getDate();
    const cap = monthsAgo <= 1 ? Math.min(last, today.getDate()) : last;
    const d = new Date(y, m, Math.min(day, cap), hour, (day * 13) % 60);
    return d.toISOString();
  };
  const at$ = (
    when: string,
    accountId: string,
    description: string,
    amount: number,
    category: Tx['category'],
    method?: Tx['method'],
    kind: Tx['kind'] = 'saida',
  ): Tx => ({ id: `t${++n}`, kind, accountId, amount, description, category, method, date: when, createdAt: when });

  for (const [ago, luz, gas, netflix] of [
    [1, 118.4, 89.9, 39.9],
    [2, 121.7, 84.5, 39.9],
    [3, 115.2, 92.3, 39.9],
  ] as const) {
    txs.push(
      at$(onMonth(ago, 4, 9), 'a-itau', 'Salário', 6200, 'salario', 'ted', 'entrada'),
      at$(onMonth(ago, 5, 10), 'a-itau', 'Aluguel', 1850, 'casa', 'pix'),
      at$(onMonth(ago, 6, 9), 'a-itau', 'Conta de luz Enel', luz, 'contas', 'boleto'),
      at$(onMonth(ago, 9, 9), 'a-itau', 'Conta de gás Comgás', gas, 'contas', 'boleto'),
      at$(onMonth(ago, 10, 9), 'a-itau', 'Internet Vivo', 119.99, 'contas', 'boleto'),
      at$(onMonth(ago, 3, 21), 'a-nucard', 'Netflix', netflix, 'assinaturas', 'cartao'),
      at$(onMonth(ago, 2, 8), 'a-nucard', 'Spotify', 21.9, 'assinaturas', 'cartao'),
      at$(onMonth(ago, 7, 6), 'a-nu', 'Academia Smart Fit', 99.9, 'saude', 'debito'),
      at$(onMonth(ago, 8, 18), 'a-nu', 'Mercado Extra', 395 + ago * 12.4, 'mercado', 'debito'),
      at$(onMonth(ago, 9, 19), 'a-nucard', 'iFood', 52.4, 'alimentacao', 'cartao'),
      at$(onMonth(ago, 11, 19), 'a-nucard', 'Uber', 31.2, 'transporte', 'cartao'),
    );
  }
  // açaí: este mês já passou do mês passado inteiro
  txs.push(
    at$(onMonth(1, 3, 16), 'a-nu', 'Açaí do Zé', 28, 'alimentacao', 'pix'),
    at$(onMonth(1, 6, 16), 'a-nu', 'Açaí Concept', 26.9, 'alimentacao', 'debito'),
    at$(onMonth(0, 1, 15), 'a-nu', 'Açaí do Zé', 24.9, 'alimentacao', 'pix'),
    at$(onMonth(0, 4, 16), 'a-nu', 'Açaí Concept', 27.5, 'alimentacao', 'debito'),
    at$(onMonth(0, 8, 16), 'a-nu', 'Açaí do Zé', 31, 'alimentacao', 'pix'),
    at$(onMonth(0, 12, 17), 'a-nu', 'Açaí do Zé', 22.9, 'alimentacao', 'pix'),
  );

  const due = (days: number) => {
    const d = addDays(today, days);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  };

  const bills: Bill[] = [
    {
      id: 'b-agua',
      title: 'Conta de água Sabesp',
      amount: 86.4,
      dueDate: due(4),
      category: 'contas',
      accountId: 'a-itau',
      repeatMonthly: true,
      paid: false,
      createdAt: at(40),
    },
    {
      id: 'b-net',
      title: 'Internet Vivo',
      amount: 119.99,
      dueDate: due(18),
      category: 'contas',
      accountId: 'a-itau',
      repeatMonthly: true,
      paid: false,
      createdAt: at(40),
    },
    {
      id: 'b-aluguel',
      title: 'Aluguel',
      amount: 1850,
      dueDate: due(24),
      category: 'casa',
      accountId: 'a-itau',
      repeatMonthly: true,
      paid: false,
      createdAt: at(40),
    },
    {
      id: 'b-luz',
      title: 'Conta de luz Enel',
      amount: 142.8,
      dueDate: due(-2),
      category: 'contas',
      accountId: 'a-itau',
      repeatMonthly: false,
      paid: true,
      paidAt: at(3),
      paidTxId: 't7',
      createdAt: at(40),
    },
    {
      id: 'b-luz-0',
      title: 'Conta de luz Enel',
      amount: 151.2,
      dueDate: due(-32),
      category: 'contas',
      repeatMonthly: false,
      paid: true,
      paidAt: at(33),
      createdAt: at(70),
    },
    {
      id: 'b-net-0',
      title: 'Internet Vivo',
      amount: 119.99,
      dueDate: due(-12),
      category: 'contas',
      repeatMonthly: false,
      paid: true,
      paidAt: at(12),
      createdAt: at(70),
    },
  ];

  const ym = (daysAgo: number) => at(daysAgo, 18);
  const holdings: Holding[] = [
    {
      id: 'h1',
      accountId: 'a-xp',
      name: 'Tesouro Selic 2029',
      kind: 'Tesouro',
      value: 6200,
      invested: 5980,
      yields: [{ date: ym(1), amount: 53.4 }],
      createdAt: at(360),
    },
    {
      id: 'h2',
      accountId: 'a-xp',
      name: 'CDB liquidez diária 102% CDI',
      kind: 'CDB',
      value: 4850.27,
      invested: 4600,
      yields: [{ date: ym(1), amount: 42.85 }],
      createdAt: at(300),
    },
    {
      id: 'h3',
      accountId: 'a-xp',
      name: 'IVVB11',
      kind: 'ETF',
      value: 3000,
      invested: 2700,
      yields: [{ date: ym(2), amount: 62.84 }],
      createdAt: at(240),
    },
    {
      id: 'h4',
      accountId: 'a-xp',
      name: 'MXRF11',
      kind: 'FII',
      value: 2400,
      invested: 2380,
      yields: [{ date: ym(2), amount: 24.23 }],
      createdAt: at(200),
    },
    {
      id: 'h5',
      accountId: 'a-xp',
      name: 'ITSA4',
      kind: 'Ações',
      value: 2000,
      invested: 2150,
      yields: [{ date: ym(1), amount: -23.88 }],
      createdAt: at(180),
    },
  ];

  const sealAt = (monthsAgo: number) =>
    new Date(today.getFullYear(), today.getMonth() - monthsAgo, 2, 10).toISOString();

  return {
    version: 2,
    onboarded: false,
    demo: true,
    settings: { ...DEFAULT_SETTINGS },
    baiu: { ...DEFAULT_LOOK },
    assistant: createAssistant(),
    bank: createBank(),
    accounts,
    txs,
    bills,
    holdings,
    seals: {
      'primeira-conta': sealAt(6),
      'reserva-1': sealAt(3),
      'mes-azul': sealAt(0),
      'constancia-3': sealAt(1),
    },
    createdAt: now.toISOString(),
  };
}
