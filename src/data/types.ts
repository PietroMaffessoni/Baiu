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
  /** Conta conectada pelo Open Finance: o saldo vem do banco. */
  link?: AccountLink;
  createdAt: string;
};

export type AccountLink = {
  /** Conexão (item) no provedor. */
  item: string;
  /** Conta no provedor. Para a carteira de investimentos: `inv:<item>`. */
  remote: string;
  /** Final do número da conta ou do cartão, para reconhecer. */
  last4?: string;
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
  /** Veio do banco pelo Open Finance. Não mexe nos saldos: o saldo já vem do banco. */
  ext?: { id: string; item: string };
  /** Categoria incerta: aparece em "Confira" para a pessoa olhar. */
  review?: boolean;
  /** Quem escolheu a categoria: o banco, o Baiu, uma regra aprendida ou a pessoa. */
  catBy?: 'banco' | 'baiu' | 'aprendida' | 'pessoa';
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
  /** Veio da corretora pelo Open Finance. */
  ext?: { id: string; item: string };
  createdAt: string;
};

export type BankItemStatus = 'ok' | 'atualizando' | 'reconectar' | 'erro';

/** Uma conexão com um banco ou corretora. */
export type BankItem = {
  id: string;
  /** Nome da instituição, como o provedor informa. */
  name: string;
  bankId: string;
  status: BankItemStatus;
  /** Quando o banco coletou os dados pela última vez. */
  updatedAt?: string;
  /** Quando o Baiu buscou os dados pela última vez. */
  syncedAt?: string;
  /** Quando a pessoa autorizou (consentimento). */
  connectedAt: string;
};

export type Bank = {
  items: BankItem[];
  /** Movimentos que a pessoa apagou: não voltam na próxima busca. */
  ignored: Record<string, true>;
  /** Contas do banco que a pessoa removeu do Baiu. */
  hiddenAccounts: Record<string, true>;
  /** Categorias aprendidas com as correções da pessoa: chave do gasto -> categoria. */
  rules: Record<string, Category>;
};

export type Settings = {
  hideValues: boolean;
  /** Pede Face ID, digital ou código do aparelho ao abrir. */
  lock: boolean;
  /** Lembra os vencimentos por notificação local. */
  reminders: boolean;
  /** Avisa por notificação quando o Baiu nota um gasto fora do normal. */
  alerts: boolean;
  /** Avisa dois dias antes de o mês grátis da assinatura virar cobrança. */
  trialReminder: boolean;
};

/** Sugestão de vencimento que o Baiu tira de uma conta que se repete. */
export type BillSuggestion = { title: string; amount: number; category: OutCategory; day: number };

export type ChatMsg = {
  id: string;
  role: 'user' | 'baiu';
  text: string;
  at: string;
  /**
   * De onde veio a fala do Baiu: 'ia' (inteligência artificial), 'pronta'
   * (respondida no aparelho), 'aviso' (algo que o Baiu notou nos gastos).
   */
  source?: 'ia' | 'pronta' | 'aviso';
  /** Pergunta sugerida para continuar a conversa. */
  ask?: string;
  bill?: BillSuggestion;
};

export type Assistant = {
  /** Consentimento para a conversa com IA (LGPD): versão do texto aceito e data. */
  consent: { version: string; at: string } | null;
  /** A pessoa disse "agora não" para a IA; o convite fica discreto. */
  declined: boolean;
  /** Revogação feita sem internet, ainda não registrada no servidor. */
  pendingRevoke: boolean;
  /** Manda o resumo dos números junto com a pergunta. */
  shareNumbers: boolean;
  /** Já viu a apresentação do Baiu no início. */
  greeted: boolean;
  chat: ChatMsg[];
  /** Avisos já vistos no app: id -> data. */
  seen: Record<string, string>;
  /** Avisos já mandados por notificação: id -> data. */
  notified: Record<string, string>;
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
  /** Bancos conectados pelo Open Finance e o que o Baiu aprendeu com eles. */
  bank: Bank;
  /** O Baiu assistente: conversa, avisos e consentimento da IA. */
  assistant: Assistant;
  /** Selos conquistados: id -> data ISO. Selo carimbado não some. */
  seals: Record<string, string>;
  createdAt: string;
};
