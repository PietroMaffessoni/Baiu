import AsyncStorage from '@react-native-async-storage/async-storage';

import { checkName, checkPassword, checkPhone } from './validation';
import { AuthFailure, type AuthBackend, type Profile } from './types';

/**
 * Servidor de contas de mentira, só para testes automatizados e para o app em
 * desenvolvimento (EXPO_PUBLIC_AUTH_FAKE=1), na web ou no Expo Go. Imita as respostas do
 * Supabase, inclusive o silêncio para e-mails já cadastrados. Nunca é usado
 * nos builds das lojas.
 */
export const FAKE_CODE = '246810';

type Row = { profile: Profile; password: string; confirmed: boolean; consent: Record<string, unknown> };
type Db = { users: Record<string, Row>; session: string | null };

const KEY = 'baiu:fake-auth';

type Store = { ready: Promise<void>; load: () => Db; save: (d: Db) => void };

function memoryStore(): Store {
  let db: Db = { users: {}, session: null };
  return { ready: Promise.resolve(), load: () => db, save: (d: Db) => void (db = d) };
}

/** No celular: em memória, copiado no aparelho para a conta de teste sobreviver ao fechar o app. */
function deviceStore(): Store {
  let db: Db = { users: {}, session: null };
  const ready = AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) db = JSON.parse(raw) as Db;
    })
    .catch(() => {});
  return {
    ready,
    load: () => db,
    save: (d: Db) => {
      db = d;
      AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
    },
  };
}

function browserStore(): Store {
  return {
    ready: Promise.resolve(),
    load: (): Db => {
      try {
        return JSON.parse(localStorage.getItem(KEY) ?? '') as Db;
      } catch {
        return { users: {}, session: null };
      }
    },
    save: (d: Db) => localStorage.setItem(KEY, JSON.stringify(d)),
  };
}

export function createFakeBackend(
  opts: { latencyMs?: number; offline?: () => boolean; persist?: boolean } = {},
): AuthBackend & {
  _db: () => Db;
} {
  const store =
    typeof localStorage !== 'undefined' ? browserStore() : opts.persist ? deviceStore() : memoryStore();
  const listeners = new Set<(p: Profile | null) => void>();
  const lastSend: Record<string, number> = {};
  let resetFor: string | null = null;

  const wait = async () => {
    await store.ready;
    if (opts.offline?.()) throw new AuthFailure('network');
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
  };
  const db = () => store.load();
  const emit = (p: Profile | null) => listeners.forEach((l) => l(p));
  const setSession = (email: string | null) => {
    const d = db();
    d.session = email;
    store.save(d);
    emit(email ? d.users[email].profile : null);
  };
  const current = () => {
    const d = db();
    return d.session ? d.users[d.session] : undefined;
  };
  const send = (email: string) => {
    const now = Date.now();
    if (lastSend[email] && now - lastSend[email] < 60_000) throw new AuthFailure('rate_limited');
    lastSend[email] = now;
  };
  const validProfile = (fullName: string, phone: string) =>
    checkName(fullName).ok && checkPhone(phone).ok && /^\+55\d{11}$/.test(phone);

  return {
    configured: true,
    _db: db,

    async restore() {
      await store.ready;
      return current()?.profile ?? null;
    },

    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signUp({ email, password, fullName, phone, consent }) {
      await wait();
      if (!checkPassword(password, { email, name: fullName }).ok) throw new AuthFailure('weak_password');
      if (!validProfile(fullName, phone) || consent.adult !== true) throw new AuthFailure('invalid_data');
      const d = db();
      if (d.users[email]?.confirmed) return; // silêncio, como o Supabase
      send(email);
      d.users[email] = {
        profile: { id: `u-${Object.keys(d.users).length + 1}-${email.length}`, email, fullName, phone, createdAt: new Date().toISOString() },
        password,
        confirmed: false,
        consent: { ...consent, at: new Date().toISOString() },
      };
      store.save(d);
    },

    async verifySignUp(email, code) {
      await wait();
      const d = db();
      const row = d.users[email];
      if (!row || row.confirmed || code !== FAKE_CODE) throw new AuthFailure('invalid_code');
      row.confirmed = true;
      store.save(d);
      setSession(email);
      return row.profile;
    },

    async resendSignUp(email) {
      await wait();
      const row = db().users[email];
      if (row && !row.confirmed) send(email);
    },

    async signIn(email, password) {
      await wait();
      const row = db().users[email];
      if (!row || row.password !== password) throw new AuthFailure('invalid_credentials');
      if (!row.confirmed) throw new AuthFailure('email_not_confirmed');
      setSession(email);
      return row.profile;
    },

    async requestReset(email) {
      await wait();
      const row = db().users[email];
      if (row?.confirmed) {
        send(email);
        resetFor = email;
      }
    },

    async verifyReset(email, code) {
      await wait();
      if (resetFor !== email || code !== FAKE_CODE) throw new AuthFailure('invalid_code');
      resetFor = null;
      setSession(email);
      return db().users[email].profile;
    },

    async updatePassword(password) {
      await wait();
      const d = db();
      const row = d.session ? d.users[d.session] : undefined;
      if (!row) throw new AuthFailure('session_expired');
      if (row.password === password) throw new AuthFailure('same_password');
      if (!checkPassword(password, { email: row.profile.email, name: row.profile.fullName }).ok) {
        throw new AuthFailure('weak_password');
      }
      row.password = password;
      store.save(d);
    },

    async confirmPassword(email, password) {
      await wait();
      const row = db().users[email];
      if (!row || row.password !== password) throw new AuthFailure('invalid_credentials');
    },

    async updateProfile({ fullName, phone }) {
      await wait();
      const d = db();
      const row = d.session ? d.users[d.session] : undefined;
      if (!row) throw new AuthFailure('session_expired');
      if (!validProfile(fullName, phone)) throw new AuthFailure('invalid_data');
      row.profile = { ...row.profile, fullName, phone };
      store.save(d);
      emit(row.profile);
      return row.profile;
    },

    async deleteAccount() {
      await wait();
      const d = db();
      if (!d.session) throw new AuthFailure('session_expired');
      delete d.users[d.session];
      d.session = null;
      store.save(d);
      emit(null);
    },

    async signOut() {
      setSession(null);
    },
  };
}
