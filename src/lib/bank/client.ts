import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { getSupabaseClient } from '../auth/supabase';
import { fakeBankData, FAKE_BANKS } from './fake-data';
import type { RemoteItem, SyncPayload } from './types';

/** Versão do texto de autorização da conexão de contas. Mudou o texto, muda a versão. */
export const BANK_CONSENT_VERSION = '2026-10-15';

/** Para onde o banco devolve a pessoa depois de autorizar no app dele. */
export const OAUTH_REDIRECT = 'baiu://open-finance';

export type BankErrorCode = 'not_configured' | 'network' | 'session' | 'not_found' | 'busy' | 'subscription' | 'unknown';

export class BankFailure extends Error {
  constructor(public code: BankErrorCode) {
    super(code);
    this.name = 'BankFailure';
  }
}

export const BANK_MESSAGES: Record<BankErrorCode, string> = {
  not_configured: 'A conexão com bancos ainda não está disponível.',
  network: 'Sem conexão com a internet. Confira a rede e tente de novo.',
  session: 'Sua sessão terminou. Entre de novo.',
  not_found: 'Essa conexão não existe mais. Conecte o banco de novo.',
  busy: 'O serviço de conexão está ocupado agora. Tente daqui a pouco.',
  subscription: 'Bancos conectados fazem parte da assinatura, que não está ativa. Veja em Ajustes, Assinatura.',
  unknown: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
};

export interface BankBackend {
  readonly available: boolean;
  /** Banco de teste, sem o widget de verdade (testes e web de desenvolvimento). */
  readonly fake: boolean;
  /** Token de uso único para abrir o widget de conexão. Com `itemId`, reconecta esse banco. */
  connectToken(itemId?: string): Promise<{ token: string; sandbox: boolean }>;
  /** Liga ao usuário a conexão recém-criada no widget. */
  link(itemId: string): Promise<RemoteItem>;
  /** Busca contas, movimentos e investimentos de todas as conexões. `since`: última busca de cada uma. */
  sync(since: Record<string, string>): Promise<SyncPayload>;
  /** Pede ao banco dados novos agora. */
  refresh(itemId: string): Promise<void>;
  /** Desconecta: apaga a conexão no provedor e encerra a autorização. */
  unlink(itemId: string): Promise<void>;
  unlinkAll(): Promise<void>;
}

const STATUS: Record<number, BankErrorCode> = {
  401: 'session',
  402: 'subscription',
  403: 'not_found',
  404: 'not_found',
  429: 'busy',
  503: 'not_configured',
};

async function failure(e: unknown): Promise<BankFailure> {
  if (e instanceof BankFailure) return e;
  if (e instanceof FunctionsFetchError) return new BankFailure('network');
  if (e instanceof FunctionsHttpError) {
    const res = e.context as Response | undefined;
    let code: string | undefined;
    try {
      code = ((await res?.clone().json()) as { error?: string } | undefined)?.error;
    } catch {}
    if (code && code in BANK_MESSAGES) return new BankFailure(code as BankErrorCode);
    return new BankFailure(STATUS[res?.status ?? 0] ?? 'unknown');
  }
  if (e instanceof TypeError && /network|fetch/i.test(e.message)) return new BankFailure('network');
  return new BankFailure('unknown');
}

export function createSupabaseBank(): BankBackend {
  const call = async <T>(action: string, body: Record<string, unknown> = {}): Promise<T> => {
    const client = getSupabaseClient();
    if (!client) throw new BankFailure('not_configured');
    try {
      const { data, error } = await client.functions.invoke<T>('bank', { body: { action, ...body } });
      if (error) throw error;
      return data as T;
    } catch (e) {
      throw await failure(e);
    }
  };
  return {
    get available() {
      return getSupabaseClient() !== null;
    },
    fake: false,
    connectToken: (itemId) => call('token', { itemId, redirect: OAUTH_REDIRECT, consentVersion: BANK_CONSENT_VERSION }),
    link: (itemId) => call('link', { itemId, consentVersion: BANK_CONSENT_VERSION }),
    sync: (since) => call('sync', { since }),
    refresh: async (itemId) => {
      await call('refresh', { itemId });
    },
    unlink: async (itemId) => {
      await call('unlink', { itemId });
    },
    unlinkAll: async () => {
      await call('unlink_all');
    },
  };
}

type FakeDb = { items: { id: string; name: string; at: string }[]; n: number };
const FAKE_KEY = 'baiu:fake-bank';

/**
 * Banco de mentira para testes automatizados e para a web de desenvolvimento
 * (EXPO_PUBLIC_AUTH_FAKE=1). Gera um histórico realista e determinístico,
 * que cresce com o tempo, como um banco de verdade.
 */
export function createFakeBank(opts: { latencyMs?: number; now?: () => Date; offline?: () => boolean } = {}) {
  let memory: FakeDb = { items: [], n: 0 };
  const browser = typeof localStorage !== 'undefined';
  const load = (): FakeDb => {
    if (!browser) return memory;
    try {
      return { items: [], n: 0, ...JSON.parse(localStorage.getItem(FAKE_KEY) ?? '{}') };
    } catch {
      return { items: [], n: 0 };
    }
  };
  const save = (d: FakeDb) => (browser ? localStorage.setItem(FAKE_KEY, JSON.stringify(d)) : void (memory = d));
  const wait = async () => {
    if (opts.offline?.()) throw new BankFailure('network');
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
  };
  const now = () => opts.now?.() ?? new Date();

  const backend: BankBackend & { _db: () => FakeDb; _create: (bank: string) => string } = {
    available: true,
    fake: true,
    _db: load,
    /** O "widget" de teste cria a conexão. */
    _create: (bank) => {
      const d = load();
      const id = `fake-${bank}-${++d.n}`;
      d.items.push({
        id,
        name: FAKE_BANKS.find((b) => b.id === bank)?.name ?? 'Banco Exemplo',
        at: now().toISOString(),
      });
      save(d);
      return id;
    },
    async connectToken() {
      await wait();
      return { token: 'fake-token', sandbox: true };
    },
    async link(itemId) {
      await wait();
      const it = load().items.find((i) => i.id === itemId);
      if (!it) throw new BankFailure('not_found');
      return { id: it.id, name: it.name, status: 'UPDATED', updatedAt: now().toISOString() };
    },
    async sync() {
      await wait();
      const parts = load().items.map((i) => fakeBankData(i.id, i.name, now()));
      return {
        items: parts.flatMap((p) => p.items),
        accounts: parts.flatMap((p) => p.accounts),
        transactions: parts.flatMap((p) => p.transactions),
        investments: parts.flatMap((p) => p.investments),
      };
    },
    async refresh(itemId) {
      await wait();
      if (!load().items.some((i) => i.id === itemId)) throw new BankFailure('not_found');
    },
    async unlink(itemId) {
      await wait();
      const d = load();
      save({ ...d, items: d.items.filter((i) => i.id !== itemId) });
    },
    async unlinkAll() {
      await wait();
      save({ ...load(), items: [] });
    },
  };
  return backend;
}

const useFake = process.env.EXPO_PUBLIC_AUTH_FAKE === '1' && (__DEV__ || Platform.OS === 'web');

export const bankBackend: BankBackend = useFake ? createFakeBank({ latencyMs: 300 }) : createSupabaseBank();
