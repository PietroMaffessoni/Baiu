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
  /** Categoria do provedor, em inglês ("Groceries", "Salary"...), quando houver. */
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
