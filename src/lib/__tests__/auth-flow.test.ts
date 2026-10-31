/* eslint-disable @typescript-eslint/no-require-imports -- os testes recarregam módulos com require */
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { createFakeBackend, FAKE_CODE } from '../auth/fake';
import { mapError } from '../auth/supabase';
import { AuthFailure, PRIVACY_VERSION, TERMS_VERSION, type SignUpInput } from '../auth/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)) }));

const input = (p: Partial<SignUpInput> = {}): SignUpInput => ({
  email: 'maria.silva@gmail.com',
  password: 'Lanterna#42',
  fullName: 'Maria Silva',
  phone: '+5511996421873',
  consent: { terms: TERMS_VERSION, privacy: PRIVACY_VERSION, adult: true },
  ...p,
});

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as AuthFailure).code;
  }
  return 'ok';
}

describe('cadastro e confirmação', () => {
  it('servidor recusa senha fraca e dados inválidos, mesmo sem o app', async () => {
    const b = createFakeBackend();
    expect(await code(b.signUp(input({ password: 'fraca' })))).toBe('weak_password');
    expect(await code(b.signUp(input({ phone: '+5511887654321' })))).toBe('invalid_data');
    expect(await code(b.signUp(input({ fullName: 'Maria' })))).toBe('invalid_data');
  });

  it('só entra depois de confirmar o e-mail com o código', async () => {
    const b = createFakeBackend();
    await b.signUp(input());
    expect(await code(b.signIn('maria.silva@gmail.com', 'Lanterna#42'))).toBe('email_not_confirmed');
    expect(await code(b.verifySignUp('maria.silva@gmail.com', '000000'))).toBe('invalid_code');
    const p = await b.verifySignUp('maria.silva@gmail.com', FAKE_CODE);
    expect(p).toMatchObject({ email: 'maria.silva@gmail.com', fullName: 'Maria Silva', phone: '+5511996421873' });
    expect(await b.restore()).toMatchObject({ email: 'maria.silva@gmail.com' });
  });

  it('não revela que o e-mail já tem conta', async () => {
    const b = createFakeBackend();
    await b.signUp(input());
    await b.verifySignUp('maria.silva@gmail.com', FAKE_CODE);
    await b.signOut();
    expect(await code(b.signUp(input({ password: 'Outra#Senha77' })))).toBe('ok');
    // a senha original continua valendo
    expect(await code(b.signIn('maria.silva@gmail.com', 'Lanterna#42'))).toBe('ok');
  });

  it('no celular, a conta de teste continua lá depois de fechar o app', async () => {
    const b = createFakeBackend({ persist: true });
    await b.signUp(input());
    await b.verifySignUp('maria.silva@gmail.com', FAKE_CODE);
    await new Promise((r) => setTimeout(r, 0)); // a cópia no aparelho não bloqueia
    const reopened = createFakeBackend({ persist: true });
    expect(await reopened.restore()).toMatchObject({ email: 'maria.silva@gmail.com' });
    await reopened.signOut();
    expect(await code(reopened.signIn('maria.silva@gmail.com', 'Lanterna#42'))).toBe('ok');
  });

  it('limita o reenvio do código a um por minuto', async () => {
    const b = createFakeBackend();
    await b.signUp(input());
    expect(await code(b.resendSignUp('maria.silva@gmail.com'))).toBe('rate_limited');
  });
});

describe('login, senha e conta', () => {
  async function ready() {
    const b = createFakeBackend();
    await b.signUp(input());
    await b.verifySignUp('maria.silva@gmail.com', FAKE_CODE);
    return b;
  }

  it('senha errada recebe mensagem genérica', async () => {
    const b = await ready();
    await b.signOut();
    expect(await b.restore()).toBeNull();
    expect(await code(b.signIn('maria.silva@gmail.com', 'Errada#123x'))).toBe('invalid_credentials');
    expect(await code(b.signIn('ninguem@gmail.com', 'Lanterna#42'))).toBe('invalid_credentials');
    expect(new AuthFailure('invalid_credentials').message).toBe('E-mail ou senha incorretos.');
  });

  it('recupera a senha com código e entra com a nova', async () => {
    const b = await ready();
    await b.signOut();
    await b.requestReset('ninguem@gmail.com'); // silêncio
    // o código do cadastro saiu há pouco: o servidor pede um minuto entre e-mails
    expect(await code(b.requestReset('maria.silva@gmail.com'))).toBe('rate_limited');
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    await b.requestReset('maria.silva@gmail.com');
    clock.mockRestore();
    expect(await code(b.verifyReset('maria.silva@gmail.com', '111111'))).toBe('invalid_code');
    await b.verifyReset('maria.silva@gmail.com', FAKE_CODE);
    expect(await code(b.updatePassword('Lanterna#42'))).toBe('same_password');
    expect(await code(b.updatePassword('fraquinha'))).toBe('weak_password');
    await b.updatePassword('Peixe-Lua#2077');
    await b.signOut();
    expect(await code(b.signIn('maria.silva@gmail.com', 'Lanterna#42'))).toBe('invalid_credentials');
    expect(await code(b.signIn('maria.silva@gmail.com', 'Peixe-Lua#2077'))).toBe('ok');
  });

  it('atualiza o perfil e avisa quem está ouvindo', async () => {
    const b = await ready();
    const seen: unknown[] = [];
    b.subscribe((p) => seen.push(p?.fullName));
    expect(await code(b.updateProfile({ fullName: 'Maria', phone: '+5511996421873' }))).toBe('invalid_data');
    await b.updateProfile({ fullName: 'Maria Souza', phone: '+5521991234560' });
    expect(seen).toContain('Maria Souza');
    expect(await b.restore()).toMatchObject({ fullName: 'Maria Souza', phone: '+5521991234560' });
  });

  it('excluir a conta apaga o acesso', async () => {
    const b = await ready();
    await b.deleteAccount();
    expect(await b.restore()).toBeNull();
    expect(await code(b.signIn('maria.silva@gmail.com', 'Lanterna#42'))).toBe('invalid_credentials');
  });

  it('sem internet, explica a falta de rede', async () => {
    let offline = false;
    const b = createFakeBackend({ offline: () => offline });
    offline = true;
    expect(await code(b.signIn('maria.silva@gmail.com', 'Lanterna#42'))).toBe('network');
  });
});

describe('erros do Supabase em português', () => {
  it.each([
    [new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'), 'invalid_credentials'],
    [new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'), 'email_not_confirmed'],
    [new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'), 'invalid_code'],
    [new AuthApiError('For security purposes...', 429, 'over_email_send_rate_limit'), 'rate_limited'],
    [new AuthApiError('Too many', 429, undefined), 'rate_limited'],
    [new AuthApiError('Password is known to be weak', 422, 'weak_password'), 'weak_password'],
    [new AuthApiError('New password should be different', 422, 'same_password'), 'same_password'],
    [new AuthApiError('Database error saving new user', 500, 'unexpected_failure'), 'invalid_data'],
    [new AuthRetryableFetchError('Network request failed', 0), 'network'],
    [new TypeError('Network request failed'), 'network'],
    [new Error('???'), 'unknown'],
  ])('%s', (err, expected) => {
    expect(mapError(err).code).toBe(expected);
  });

  it('toda falha tem mensagem em português', () => {
    expect(mapError(new Error('x')).message).toMatch(/Algo deu errado/);
    expect(new AuthFailure('rate_limited').message).toMatch(/Espere/);
  });
});
