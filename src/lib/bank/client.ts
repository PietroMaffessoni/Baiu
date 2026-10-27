import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { getSupabaseClient } from '../auth/supabase';
import { PRODUCTS } from './consent-text';
import { validCpf } from './cpf';
import { fakeBankData, FAKE_BANKS } from './fake-data';
import type { ConnectStart, ConsentRecord, Institution, RemoteItem, SyncPayload } from './types';

/** Versão do texto de autorização da conexão de contas. Mudou o texto, muda a versão. */
export const BANK_CONSENT_VERSION = '2026-10-23';

export type BankErrorCode =
  | 'not_configured'
  | 'network'
  | 'session'
  | 'not_found'
  | 'busy'
  | 'subscription'
  | 'cpf'
  | 'bank_down'
  | 'refused'
  | 'unknown';

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
  cpf: 'Confira o CPF. Ele precisa ser o do titular da conta no banco.',
  bank_down: 'Esse banco está fora do ar no Open Finance agora. Tente mais tarde.',
  refused: 'O banco não aceitou o pedido agora. Tente de novo em instantes ou escolha outro banco.',
  unknown: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
};

export interface BankBackend {
  readonly available: boolean;
  /** Banco de teste, sem banco de verdade (testes e web de desenvolvimento). */
  readonly fake: boolean;
  /** Bancos de pessoa física disponíveis no Open Finance. */
  institutions(): Promise<Institution[]>;
  /** Cria a autorização e devolve o endereço onde a pessoa autoriza no banco. */
  start(institutionId: string, cpf: string): Promise<ConnectStart>;
  /** Refaz a autorização de um banco (vencida, recusada ou para renovar). */
  reconnect(itemId: string): Promise<ConnectStart>;
  /** Situação da autorização: a pessoa já voltou do banco? */
  status(itemId: string): Promise<{ consent: string; item: RemoteItem }>;
  /** Busca contas, movimentos e investimentos de todas as conexões. `since`: última busca de cada uma. */
  sync(since: Record<string, string>): Promise<SyncPayload>;
  /** Todas as autorizações já dadas, inclusive as canceladas. */
  history(): Promise<ConsentRecord[]>;
  /** Desconecta: cancela a autorização no Open Finance. */
  unlink(itemId: string): Promise<void>;
  unlinkAll(): Promise<void>;
}

const STATUS: Record<number, BankErrorCode> = {
  401: 'session',
  402: 'subscription',
  403: 'not_found',
  404: 'not_found',
  409: 'bank_down',
  422: 'refused',
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
    institutions: async () => (await call<{ institutions: Institution[] }>('institutions')).institutions,
    start: (institutionId, cpf) => call('start', { institutionId, cpf, consentVersion: BANK_CONSENT_VERSION }),
    reconnect: (itemId) => call('reconnect', { itemId, consentVersion: BANK_CONSENT_VERSION }),
    status: (itemId) => call('status', { itemId }),
    sync: (since) => call('sync', { since }),
    history: async () => (await call<{ consents: ConsentRecord[] }>('history')).consents,
    unlink: async (itemId) => {
      await call('unlink', { itemId });
    },
    unlinkAll: async () => {
      await call('unlink_all');
    },
  };
}

type FakeDb = { items: { id: string; name: string; at: string }[]; history: ConsentRecord[]; n: number };
const FAKE_KEY = 'baiu:fake-bank';

/**
 * Banco de mentira para testes automatizados e para a web de desenvolvimento
 * (EXPO_PUBLIC_AUTH_FAKE=1). Funciona como o ambiente de teste da Polp: a
 * autorização já nasce aprovada, sem ir ao banco, e gera um histórico
 * realista e determinístico, que cresce com o tempo, como um banco de verdade.
 */
export function createFakeBank(opts: { latencyMs?: number; now?: () => Date; offline?: () => boolean } = {}) {
  let memory: FakeDb = { items: [], history: [], n: 0 };
  const browser = typeof localStorage !== 'undefined';
  const empty = (): FakeDb => ({ items: [], history: [], n: 0 });
  const load = (): FakeDb => {
    if (!browser) return memory;
    try {
      return { ...empty(), ...JSON.parse(localStorage.getItem(FAKE_KEY) ?? '{}') };
    } catch {
      return empty();
    }
  };
  const save = (d: FakeDb) => (browser ? localStorage.setItem(FAKE_KEY, JSON.stringify(d)) : void (memory = d));
  const wait = async () => {
    if (opts.offline?.()) throw new BankFailure('network');
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
  };
  const now = () => opts.now?.() ?? new Date();
  const remote = (it: FakeDb['items'][number]): RemoteItem => ({
    id: it.id,
    name: it.name,
    status: 'UPDATED',
    updatedAt: now().toISOString(),
  });
  const revoke = (d: FakeDb, id: string): FakeDb => ({
    ...d,
    items: d.items.filter((i) => i.id !== id),
    history: d.history.map((h) =>
      h.id === id && !h.revokedAt ? { ...h, status: 'cancelada', revokedAt: now().toISOString() } : h,
    ),
  });

  const backend: BankBackend & { _db: () => FakeDb } = {
    available: true,
    fake: true,
    _db: load,
    async institutions() {
      await wait();
      return [
        ...FAKE_BANKS.map((b) => ({ id: b.id, name: b.name, status: 'OPERATIONAL' })),
        { id: 'parado', name: 'Banco Parado de Teste', status: 'MAJOR_OUTAGE' },
      ];
    },
    async start(institutionId, cpf) {
      await wait();
      if (!validCpf(cpf)) throw new BankFailure('cpf');
      const bank = FAKE_BANKS.find((b) => b.id === institutionId);
      if (!bank) throw new BankFailure(institutionId === 'parado' ? 'bank_down' : 'not_found');
      const d = load();
      const id = `fake-${bank.id}-${++d.n}`;
      d.items.push({ id, name: bank.name, at: now().toISOString() });
      d.history.unshift({
        id,
        name: bank.name,
        createdAt: now().toISOString(),
        revokedAt: null,
        products: [...PRODUCTS],
        status: 'autorizada',
      });
      save(d);
      return { id, name: bank.name, status: 'AUTHORISED', url: null, sandbox: true };
    },
    async reconnect(itemId) {
      await wait();
      const it = load().items.find((i) => i.id === itemId);
      if (!it) throw new BankFailure('not_found');
      return { id: it.id, name: it.name, status: 'AUTHORISED', url: null, sandbox: true };
    },
    async status(itemId) {
      await wait();
      const it = load().items.find((i) => i.id === itemId);
      if (!it) throw new BankFailure('not_found');
      return { consent: 'AUTHORISED', item: remote(it) };
    },
    async sync(since) {
      await wait();
      const items = load().items;
      const parts = items.map((i) => fakeBankData(i.id, i.name, now()));
      return {
        items: parts.flatMap((p) => p.items),
        accounts: parts.flatMap((p) => p.accounts),
        transactions: parts.flatMap((p) => p.transactions),
        investments: parts.flatMap((p) => p.investments),
        revoked: Object.keys(since).filter((id) => !items.some((i) => i.id === id)),
      };
    },
    async history() {
      await wait();
      return load().history;
    },
    async unlink(itemId) {
      await wait();
      save(revoke(load(), itemId));
    },
    async unlinkAll() {
      await wait();
      const d = load();
      save(d.items.reduce((acc, i) => revoke(acc, i.id), d));
    },
  };
  return backend;
}

const useFake = process.env.EXPO_PUBLIC_AUTH_FAKE === '1' && (__DEV__ || Platform.OS === 'web');

export const bankBackend: BankBackend = useFake ? createFakeBank({ latencyMs: 300 }) : createSupabaseBank();
