export type AccountKind = 'corrente' | 'reserva' | 'cartao' | 'investimento';

export type Account = {
  id: string;
  bankId: string;
  kind: AccountKind;
  nickname?: string;
  /** Saldo. Em cartões, o valor da fatura atual (positivo = devido). */
  balance: number;
  /** Dia de vencimento da fatura (cartões). */
  dueDay?: number;
  limit?: number;
  createdAt: string;
};

export type Category =
  | 'renda'
  | 'mercado'
  | 'alimentacao'
  | 'transporte'
  | 'casa'
  | 'saude'
  | 'assinaturas'
  | 'compras'
  | 'lazer'
  | 'cartao'
  | 'reserva'
  | 'investimento';

export type Method = 'pix' | 'cartao' | 'boleto' | 'debito' | 'ted';

export type Tx = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  /** Positivo entra, negativo sai. */
  amount: number;
  category: Category;
  method: Method;
};

export type Bill = {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  accountId?: string;
};

export type Holding = {
  id: string;
  accountId: string;
  name: string;
  kind: 'Tesouro' | 'CDB' | 'FII' | 'ETF' | 'Ações';
  value: number;
  /** Rendimento do mês, em fração. */
  monthReturn: number;
};

export type State = {
  version: 1;
  onboarded: boolean;
  hideValues: boolean;
  accounts: Account[];
  txs: Tx[];
  bills: Bill[];
  holdings: Holding[];
  /** Aportes dos últimos 12 meses, do mais antigo ao mês atual. */
  contributions: number[];
  seededAt: string;
};
