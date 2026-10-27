/** Versões dos documentos aceitos no cadastro. Mudou o texto, muda a versão. */
export const TERMS_VERSION = '2026-10-27';
export const PRIVACY_VERSION = '2026-10-27';

export type Profile = {
  id: string;
  email: string;
  fullName: string;
  /** Celular em E.164, como +5511987654321. */
  phone: string;
  createdAt: string;
};

export type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  /** Aceites do cadastro (LGPD): termos, política e maioridade. */
  consent: { terms: string; privacy: string; adult: true };
};

export type AuthErrorCode =
  | 'not_configured'
  | 'network'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'invalid_code'
  | 'rate_limited'
  | 'weak_password'
  | 'same_password'
  | 'invalid_data'
  | 'session_expired'
  | 'unknown';

const MESSAGES: Record<AuthErrorCode, string> = {
  not_configured: 'O serviço de contas ainda não foi configurado neste app.',
  network: 'Sem conexão com a internet. Confira a rede e tente de novo.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail com o código que enviamos.',
  invalid_code: 'Código incorreto ou vencido. Confira ou peça um novo.',
  rate_limited: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.',
  weak_password: 'Essa senha não é forte o bastante. Siga as regras abaixo do campo.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  invalid_data: 'Alguns dados não foram aceitos. Confira os campos e tente de novo.',
  session_expired: 'Sua sessão terminou. Entre de novo.',
  unknown: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
};

export class AuthFailure extends Error {
  constructor(
    public code: AuthErrorCode,
    message = MESSAGES[code],
  ) {
    super(message);
    this.name = 'AuthFailure';
  }
}

export function authMessage(e: unknown) {
  if (e instanceof AuthFailure) return e.message;
  return MESSAGES.unknown;
}

export interface AuthBackend {
  /** Falso quando faltam as chaves do servidor. */
  readonly configured: boolean;
  /** Sessão salva no aparelho, se houver e ainda valer. */
  restore(): Promise<Profile | null>;
  /** Avisa quando a sessão muda (entrou, saiu, expirou, perfil atualizado). */
  subscribe(cb: (p: Profile | null) => void): () => void;
  /** Cria a conta e envia o código de confirmação por e-mail. */
  signUp(input: SignUpInput): Promise<void>;
  verifySignUp(email: string, code: string): Promise<Profile>;
  resendSignUp(email: string): Promise<void>;
  signIn(email: string, password: string): Promise<Profile>;
  /** Envia o código de recuperação. Não revela se o e-mail tem conta. */
  requestReset(email: string): Promise<void>;
  /** Confere o código de recuperação; a pessoa fica conectada para trocar a senha. */
  verifyReset(email: string, code: string): Promise<Profile>;
  updatePassword(password: string): Promise<void>;
  /** Confere a senha atual antes de ações sensíveis. */
  confirmPassword(email: string, password: string): Promise<void>;
  updateProfile(p: { fullName: string; phone: string }): Promise<Profile>;
  /** Exclui a conta no servidor (LGPD, art. 18). */
  deleteAccount(): Promise<void>;
  signOut(): Promise<void>;
}
