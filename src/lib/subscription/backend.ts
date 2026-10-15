import type { Entitlement, Plan } from './types';

export type SubErrorCode =
  | 'cancelled'
  | 'pending'
  | 'network'
  | 'not_allowed'
  | 'in_use'
  | 'unavailable'
  | 'store'
  | 'not_configured'
  | 'unknown';

export class SubFailure extends Error {
  constructor(public code: SubErrorCode) {
    super(code);
    this.name = 'SubFailure';
  }
}

export const SUB_MESSAGES: Record<SubErrorCode, string> = {
  cancelled: '',
  pending: 'O pagamento ficou pendente. Assim que a loja confirmar, a assinatura começa.',
  network: 'Sem conexão com a internet. Confira a rede e tente de novo.',
  not_allowed: 'Este aparelho não permite compras. Confira as restrições de compras nos ajustes do aparelho.',
  in_use:
    'Esta conta da loja já tem uma assinatura do Baiu ligada a outra conta. Entre com aquela conta ou fale com o suporte.',
  unavailable: 'A assinatura não está disponível agora. Tente de novo em instantes.',
  store: 'A loja não respondeu. Tente de novo em instantes.',
  not_configured: 'As assinaturas ainda não estão disponíveis nesta versão do app.',
  unknown: 'Algo deu errado. Tente de novo em instantes.',
};

export const subMessage = (e: unknown) => SUB_MESSAGES[e instanceof SubFailure ? e.code : 'unknown'];

export interface SubscriptionBackend {
  /** Falso quando este build não tem as lojas configuradas: o app fica liberado. */
  readonly enabled: boolean;
  /** Loja de teste (testes automatizados e web de desenvolvimento). */
  readonly fake: boolean;
  /** Liga a assinatura à conta (o id da conta, nunca e-mail ou nome) e devolve o estado. */
  identify(userId: string): Promise<Entitlement>;
  /** Estado atual. `force` ignora o que a loja guardou há pouco (ex.: depois de cancelar). */
  refresh(force?: boolean): Promise<Entitlement>;
  plans(): Promise<Plan[]>;
  purchase(planId: string): Promise<Entitlement>;
  /** Traz de volta uma assinatura feita com esta conta da loja. */
  restore(): Promise<Entitlement>;
  /** Abre a página da loja onde a pessoa cancela, reativa ou troca a forma de pagamento. */
  manage(ent: Entitlement): Promise<void>;
  signOut(): Promise<void>;
  onChange(cb: (e: Entitlement) => void): () => void;
  /** Apaga o cadastro da pessoa no RevenueCat (exclusão da conta). */
  forget(): Promise<void>;
}
