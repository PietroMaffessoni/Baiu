/**
 * O que a função `bank` do servidor devolve, já enxuto: só o necessário para
 * montar contas, movimentos e investimentos no aparelho. Sem CPF, nome do
 * titular ou número completo de conta.
 */
export type RemoteItemStatus = 'UPDATED' | 'UPDATING' | 'LOGIN_ERROR' | 'OUTDATED' | 'WAITING_USER_INPUT' | string;

export type RemoteItem = {
  id: string;
  /** Nome da instituição (conector). */
  name: string;
  status: RemoteItemStatus;
  /** Última coleta feita pelo banco (ISO). */
  updatedAt?: string | null;
};

export type RemoteAccount = {
  id: string;
  itemId: string;
  type: 'BANK' | 'CREDIT';
  subtype?: string | null;
  name: string;
  last4?: string | null;
  /** Conta: saldo. Cartão: fatura em aberto (positivo = devido). */
  balance: number;
  creditLimit?: number | null;
  /** Vencimento da fatura (aaaa-mm-dd). */
  dueDate?: string | null;
};

export type RemoteTx = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  /** Valor como o banco informa; o sentido vem de `type`. */
  amount: number;
  /** CREDIT = entrou, DEBIT = saiu. */
  type: 'CREDIT' | 'DEBIT';
  /** Categoria do provedor (Polp: "FOOD_AND_DRINK_GROCERIES", "INCOME_SALARY"...), quando houver. */
  category?: string | null;
  operationType?: string | null;
  /** Do outro lado: pessoa (cpf) ou empresa (cnpj). Sem o número. */
  party?: 'cpf' | 'cnpj' | null;
};

export type RemoteInvestment = {
  id: string;
  itemId: string;
  name: string;
  type: string;
  subtype?: string | null;
  balance: number;
  /** Quanto foi aplicado, quando a instituição informa. */
  invested?: number | null;
};

export type SyncPayload = {
  items: RemoteItem[];
  accounts: RemoteAccount[];
  transactions: RemoteTx[];
  investments: RemoteInvestment[];
};

/** Banco que a pessoa pode escolher para conectar. */
export type Institution = {
  id: string;
  name: string;
  /** OPERATIONAL, DEGRADED_PERFORMANCE (instável) ou MAJOR_OUTAGE (fora do ar). */
  status: string;
};

/** Resposta de quem começa (ou refaz) uma autorização. */
export type ConnectStart = {
  /** Identificador da autorização: vira o id da conexão no app. */
  id: string;
  name: string;
  /** AWAITING_AUTHORIZATION, AUTHORISED, REJECTED ou EXPIRED. */
  status: string;
  /** Endereço onde a pessoa autoriza no banco. Sem ele, a autorização já está pronta. */
  url: string | null;
  /** Ambiente de teste da Polp: dados fictícios, sem banco de verdade. */
  sandbox: boolean;
};

export type ConsentState = 'autorizada' | 'pendente' | 'recusada' | 'vencida' | 'cancelada';

/** Uma autorização do histórico, inclusive as canceladas (exigência do Open Finance). */
export type ConsentRecord = {
  id: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
  /** Categorias de dados autorizadas (ACCOUNT, CREDIT_CARD_ACCOUNT, INVESTMENTS...). */
  products: string[];
  status: ConsentState;
};
