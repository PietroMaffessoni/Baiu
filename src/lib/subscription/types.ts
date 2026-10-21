/** Identificador do direito de uso no RevenueCat. O servidor confere o mesmo nome. */
export const ENTITLEMENT = 'assinatura';

/**
 * - teste: no mês grátis, vai renovar;
 * - ativa: pagando, vai renovar;
 * - cancelada: cancelou, usa até o fim do período e não é cobrada de novo;
 * - pagamento: a loja não conseguiu cobrar e dá um prazo para acertar;
 * - expirada: já assinou e o período acabou;
 * - nenhuma: nunca assinou.
 */
export type SubStatus = 'teste' | 'ativa' | 'cancelada' | 'pagamento' | 'expirada' | 'nenhuma';

export type SubStore = 'app_store' | 'play_store' | 'teste' | 'outra';

export type Entitlement = {
  status: SubStatus;
  active: boolean;
  /** Está (ou estava) no período grátis. */
  trial: boolean;
  /** Fim do período atual: fim do mês grátis, próxima cobrança ou fim do acesso. */
  until: string | null;
  willRenew: boolean;
  store: SubStore | null;
  productId: string | null;
  /** Página da loja para gerenciar a assinatura, quando a loja informa. */
  manageUrl: string | null;
};

export const NO_SUBSCRIPTION: Entitlement = {
  status: 'nenhuma',
  active: false,
  trial: false,
  until: null,
  willRenew: false,
  store: null,
  productId: null,
  manageUrl: null,
};

export type PeriodUnit = 'dia' | 'semana' | 'mes' | 'ano';
export type Period = { unit: PeriodUnit; count: number };

export type Plan = {
  /** Identificador do pacote no RevenueCat. */
  id: string;
  productId: string;
  period: 'mes' | 'ano';
  /** Preço já formatado pela loja, na moeda da pessoa. */
  price: string;
  amount: number;
  /** Só no anual: quanto dá por mês. */
  perMonth: string | null;
  /** Período grátis, se a pessoa ainda tem direito a ele. */
  trial: Period | null;
};
