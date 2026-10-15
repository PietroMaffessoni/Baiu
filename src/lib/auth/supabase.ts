import { createClient, isAuthError, isAuthRetryableFetchError, type User } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { sessionStorage } from './session-storage';
import { AuthFailure, type AuthBackend, type AuthErrorCode, type Profile } from './types';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const STORAGE_KEY = 'session';

function toProfile(u: User): Profile {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: u.id,
    email: u.email ?? '',
    fullName: typeof m.full_name === 'string' ? m.full_name : '',
    phone: typeof m.phone === 'string' ? m.phone : '',
    createdAt: u.created_at,
  };
}

const CODE_MAP: Record<string, AuthErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  otp_expired: 'invalid_code',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
  weak_password: 'weak_password',
  same_password: 'same_password',
  validation_failed: 'invalid_data',
  email_address_invalid: 'invalid_data',
  // gatilho de validação do banco recusou o cadastro
  unexpected_failure: 'invalid_data',
  session_not_found: 'session_expired',
  session_expired: 'session_expired',
  refresh_token_not_found: 'session_expired',
  refresh_token_already_used: 'session_expired',
  user_not_found: 'session_expired',
};

/** Converte qualquer erro do Supabase numa falha com mensagem em português. */
export function mapError(e: unknown): AuthFailure {
  if (e instanceof AuthFailure) return e;
  if (isAuthRetryableFetchError(e)) return new AuthFailure('network');
  if (e instanceof TypeError && /network|fetch/i.test(e.message)) return new AuthFailure('network');
  if (isAuthError(e)) {
    const mapped = e.code ? CODE_MAP[e.code] : undefined;
    if (mapped) return new AuthFailure(mapped);
    if (e.status === 429) return new AuthFailure('rate_limited');
    if (e.status === 422 || e.status === 400) return new AuthFailure('invalid_data');
  }
  return new AuthFailure('unknown');
}

export function createSupabaseBackend(): AuthBackend {
  const configured = /^https:\/\/.+/.test(URL) && KEY.length > 20;
  const client = configured
    ? createClient(URL, KEY, {
        auth: {
          storage: sessionStorage,
          storageKey: STORAGE_KEY,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

  // a renovação do token só roda com o app em primeiro plano
  if (client && Platform.OS !== 'web') {
    AppState.addEventListener('change', (s) => {
      if (s === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }

  const need = () => {
    if (!client) throw new AuthFailure('not_configured');
    return client;
  };

  const run = async <R extends { data: unknown; error: unknown }>(fn: () => Promise<R>): Promise<R['data']> => {
    let res: R;
    try {
      res = await fn();
    } catch (e) {
      throw mapError(e);
    }
    if (res.error) throw mapError(res.error);
    return res.data;
  };

  return {
    configured,

    async restore() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (data.session?.user) return toProfile(data.session.user);
      // sem internet e com o token vencido: a sessão guardada continua valendo
      // para abrir os dados do aparelho; o token é renovado quando a rede voltar
      if (error && isAuthRetryableFetchError(error)) {
        const raw = await sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          try {
            const stored = JSON.parse(raw) as { user?: User };
            if (stored.user?.id) return toProfile(stored.user);
          } catch {}
        }
      }
      return null;
    },

    subscribe(cb) {
      if (!client) return () => {};
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        cb(session?.user ? toProfile(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    },

    async signUp({ email, password, fullName, phone, consent }) {
      await run(() =>
        need().auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              terms_version: consent.terms,
              privacy_version: consent.privacy,
              adult: consent.adult,
            },
          },
        }),
      );
      // e-mail que já tem conta: o Supabase responde igual, sem enviar código,
      // para ninguém descobrir quem é cliente. A tela seguinte orienta a entrar.
    },

    async verifySignUp(email, code) {
      const data = await run(() => need().auth.verifyOtp({ email, token: code, type: 'email' }));
      if (!data.user) throw new AuthFailure('invalid_code');
      return toProfile(data.user);
    },

    async resendSignUp(email) {
      await run(() => need().auth.resend({ type: 'signup', email }));
    },

    async signIn(email, password) {
      const data = await run(() => need().auth.signInWithPassword({ email, password }));
      if (!data.user) throw new AuthFailure('unknown');
      return toProfile(data.user);
    },

    async requestReset(email) {
      await run(() => need().auth.resetPasswordForEmail(email));
    },

    async verifyReset(email, code) {
      const data = await run(() => need().auth.verifyOtp({ email, token: code, type: 'recovery' }));
      if (!data.user) throw new AuthFailure('invalid_code');
      return toProfile(data.user);
    },

    async updatePassword(password) {
      await run(() => need().auth.updateUser({ password }));
    },

    async confirmPassword(email, password) {
      await run(() => need().auth.signInWithPassword({ email, password }));
    },

    async updateProfile({ fullName, phone }) {
      const data = await run(() => need().auth.updateUser({ data: { full_name: fullName, phone } }));
      if (!data.user) throw new AuthFailure('unknown');
      return toProfile(data.user);
    },

    async deleteAccount() {
      const c = need();
      await run(async () => {
        const r = await c.rpc('delete_account');
        const offline = r.error && /fetch|network/i.test(r.error.message ?? '');
        return { data: r.data, error: r.error ? new AuthFailure(offline ? 'network' : 'unknown') : null };
      });
      // a conta já não existe no servidor: só falta limpar a sessão local
      await c.auth.signOut({ scope: 'local' }).catch(() => {});
    },

    async signOut() {
      if (!client) return;
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) await sessionStorage.removeItem(STORAGE_KEY);
    },
  };
}
