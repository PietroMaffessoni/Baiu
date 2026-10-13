export type AccountKind = 'corrente' | 'reserva' | 'cartao' | 'investimento';

export type Account = {
  id: string;
  bankId: string;
  kind: AccountKind;
  nickname?: string;
  /**
   * corrente e reserva: saldo disponível.
   * cartão: fatura em aberto (positivo = valor devido).
   * investimento: dinheiro parado na corretora, fora dos ativos.
   */
  balance: number;
  /** Dia de vencimento da fatura (cartões). */
  dueDay?: number;
  /** Limite do cartão. */
  limit?: number;
  createdAt: string;
};

export type TxKind = 'saida' | 'entrada' | 'transferencia';

export type OutCategory =
  | 'mercado'
  | 'alimentacao'
  | 'transporte'
  | 'casa'
  | 'contas'
  | 'saude'
  | 'educacao'
  | 'assinaturas'
  | 'compras'
  | 'lazer'
  | 'viagem'
  | 'pets'
  | 'outros';

export type InCategory = 'salario' | 'renda_extra' | 'rendimento' | 'reembolso' | 'presente' | 'outras_entradas';

export type Category = OutCategory | InCategory | 'transferencia';

export type Method = 'pix' | 'cartao' | 'debito' | 'boleto' | 'ted' | 'dinheiro';

export type Tx = {
  id: string;
  kind: TxKind;
  /** Conta de onde sai (saída, transferência) ou onde entra (entrada). */
  accountId: string;
  /** Destino da transferência. */
  toAccountId?: string;
  /** Sempre positivo; o sentido vem de `kind`. */
  amount: number;
  description: string;
  category: Category;
  method?: Method;
  date: string;
  /** Pagamento de um vencimento. */
  billId?: string;
  createdAt: string;
};

export type Bill = {
  id: string;
  title: string;
  amount: number;
  /** Data de vencimento (ISO). */
  dueDate: string;
  category: OutCategory;
  /** Conta sugerida para pagar. */
  accountId?: string;
  repeatMonthly: boolean;
  paid: boolean;
  paidAt?: string;
  paidTxId?: string;
  /** Gerado automaticamente ao pagar um vencimento recorrente. */
  fromBillId?: string;
  createdAt: string;
};

export type HoldingKind =
  'Tesouro' | 'CDB' | 'LCI/LCA' | 'Fundo' | 'FII' | 'ETF' | 'Ações' | 'Cripto' | 'Previdência' | 'Outro';

export type Holding = {
  id: string;
  accountId: string;
  name: string;
  kind: HoldingKind;
  /** Valor atual. */
  value: number;
  /** Quanto foi aplicado (custo). */
  invested: number;
  /** Variações registradas ao atualizar o valor. */
  yields: { date: string; amount: number }[];
  createdAt: string;
};

export type Settings = {
  hideValues: boolean;
  /** Pede Face ID, digital ou código do aparelho ao abrir. */
  lock: boolean;
  /** Lembra os vencimentos por notificação local. */
  reminders: boolean;
};

export type State = {
  version: 2;
  onboarded: boolean;
  /** Dados de exemplo carregados. */
  demo: boolean;
  settings: Settings;
  accounts: Account[];
  txs: Tx[];
  bills: Bill[];
  holdings: Holding[];
  /** Selos conquistados: id -> data ISO. Selo carimbado não some. */
  seals: Record<string, string>;
  createdAt: string;
};
