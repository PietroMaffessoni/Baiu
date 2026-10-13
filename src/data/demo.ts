import { addDays, startOfDay } from '@/lib/dates';
import type { Account, Bill, Holding, State, Tx } from './types';

/**
 * Dados de demonstração. Tudo aqui é sintético e ancorado na data em que o
 * app foi aberto pela primeira vez, para o mês sempre parecer vivo.
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
    { id: 'a-xp', bankId: 'xp', kind: 'investimento', balance: 18450.27, createdAt: at(300) },
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

  const t = (
    id: number,
    daysAgo: number,
    hour: number,
    accountId: string,
    description: string,
    amount: number,
    category: Tx['category'],
    method: Tx['method'],
  ): Tx => ({ id: `t${id}`, accountId, date: at(daysAgo, hour), description, amount, category, method });

  const txs: Tx[] = [
    t(1, 0, 13, 'a-nucard', 'iFood', -46.9, 'alimentacao', 'cartao'),
    t(2, 0, 9, 'a-nu', 'Pix de Ana Souza', 120, 'renda', 'pix'),
    t(3, 1, 19, 'a-nucard', 'Uber', -23.4, 'transporte', 'cartao'),
    t(4, 1, 11, 'a-nu', 'Pão de Açúcar', -187.35, 'mercado', 'debito'),
    t(5, 2, 8, 'a-nucard', 'Spotify', -21.9, 'assinaturas', 'cartao'),
    t(6, 3, 10, 'a-nu', 'Aplicação CDB liquidez diária', -800, 'investimento', 'ted'),
    t(7, 3, 9, 'a-itau', 'Conta de luz Enel', -142.8, 'casa', 'boleto'),
    t(8, 4, 18, 'a-nucard', 'Drogasil', -58.2, 'saude', 'cartao'),
    t(9, 5, 20, 'a-nucard', 'Restaurante Coco Bambu', -168, 'lazer', 'cartao'),
    t(10, 5, 8, 'a-nu', 'Posto Shell', -150, 'transporte', 'debito'),
    t(11, 6, 10, 'a-itau', 'Aluguel', -1850, 'casa', 'pix'),
    t(12, 7, 21, 'a-nucard', 'Netflix', -44.9, 'assinaturas', 'cartao'),
    t(13, 8, 9, 'a-itau', 'Salário', 6200, 'renda', 'ted'),
    t(14, 8, 10, 'a-itau', 'Para a reserva', -600, 'reserva', 'pix'),
    t(15, 9, 7, 'a-nu', 'Padaria Real', -18.5, 'alimentacao', 'debito'),
    t(16, 10, 15, 'a-inter', 'Freela de design', 950, 'renda', 'pix'),
    t(17, 10, 16, 'a-nu', 'Pagamento da fatura', -1640.22, 'cartao', 'debito'),
    t(18, 11, 14, 'a-nucard', 'Mercado Livre', -239.9, 'compras', 'cartao'),
    t(19, 12, 6, 'a-nu', 'Academia Smart Fit', -99.9, 'saude', 'debito'),
    t(20, 12, 9, 'a-itau', 'Internet Vivo', -119.99, 'casa', 'boleto'),
    t(21, 13, 8, 'a-caixa', 'Rendimento da poupança', 52.3, 'renda', 'ted'),
  ];

  const bills: Bill[] = [
    {
      id: 'b-fatura',
      title: 'Fatura Nubank',
      amount: 1284.6,
      dueDate: addDays(today, 7).toISOString(),
      paid: false,
      accountId: 'a-nucard',
    },
    {
      id: 'b-agua',
      title: 'Conta de água Sabesp',
      amount: 86.4,
      dueDate: addDays(today, 4).toISOString(),
      paid: false,
    },
    { id: 'b-luz', title: 'Conta de luz Enel', amount: 142.8, dueDate: addDays(today, -3).toISOString(), paid: true },
  ];

  const holdings: Holding[] = [
    { id: 'h1', accountId: 'a-xp', name: 'Tesouro Selic 2029', kind: 'Tesouro', value: 6200, monthReturn: 0.0087 },
    {
      id: 'h2',
      accountId: 'a-xp',
      name: 'CDB liquidez diária 102% CDI',
      kind: 'CDB',
      value: 4850.27,
      monthReturn: 0.0089,
    },
    { id: 'h3', accountId: 'a-xp', name: 'IVVB11', kind: 'ETF', value: 3000, monthReturn: 0.0214 },
    { id: 'h4', accountId: 'a-xp', name: 'MXRF11', kind: 'FII', value: 2400, monthReturn: 0.0102 },
    { id: 'h5', accountId: 'a-xp', name: 'ITSA4', kind: 'Ações', value: 2000, monthReturn: -0.0118 },
  ];

  return {
    version: 1,
    onboarded: false,
    hideValues: false,
    accounts,
    txs,
    bills,
    holdings,
    contributions: [400, 400, 0, 500, 600, 0, 700, 650, 800, 800, 750, 800],
    seededAt: now.toISOString(),
  };
}
