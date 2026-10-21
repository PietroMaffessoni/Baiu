/* eslint-disable @typescript-eslint/no-require-imports -- os testes recarregam módulos com require */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDemo, createEmpty } from '@/data/demo';
import { encryptString, toBase64 } from '../crypto';

// armazenamentos globais: sobrevivem ao jest.resetModules, como o disco do aparelho
jest.mock('@react-native-async-storage/async-storage', () => {
  const g = globalThis as unknown as { __as?: Map<string, string> };
  const m = (g.__as ??= new Map<string, string>());
  const api = {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => void m.set(k, v),
    removeItem: async (k: string) => void m.delete(k),
    multiRemove: async (ks: string[]) => ks.forEach((k) => m.delete(k)),
    getAllKeys: async () => [...m.keys()],
    clear: async () => m.clear(),
  };
  return { __esModule: true, default: api };
});
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)) }));
jest.mock('expo-secure-store', () => {
  const g = globalThis as unknown as { __ss?: Map<string, string> };
  const m = (g.__ss ??= new Map<string, string>());
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    __store: m,
    getItemAsync: jest.fn(async (k: string) => m.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void m.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void m.delete(k)),
  };
});

const secure = (require('expo-secure-store') as { __store: Map<string, string> }).__store;
const random = (n: number) => new Uint8Array(require('crypto').randomBytes(n));

beforeEach(async () => {
  await AsyncStorage.clear();
  secure.clear();
  jest.resetModules();
});

const withAccount = () => {
  const s = createEmpty();
  return { ...s, onboarded: true, accounts: [{ id: 'a', bankId: 'nubank', kind: 'corrente' as const, balance: 1234.5, createdAt: s.createdAt }] };
};

describe('cofre por conta', () => {
  it('cada conta lê só os próprios dados, cifrados', async () => {
    const vault = require('../vault') as typeof import('../vault');
    await vault.saveState('u1', withAccount());
    expect((await vault.loadState('u1')).status).toBe('ok');
    expect((await vault.loadState('u2')).status).toBe('empty');
    const keys = await AsyncStorage.getAllKeys();
    const blob = (await AsyncStorage.getItem(keys.find((k) => k.includes('u1'))!))!;
    expect(blob.startsWith('b1.')).toBe(true);
    expect(blob).not.toContain('nubank');
  });

  it('o arquivo de uma conta não abre com a chave de outra', async () => {
    const vault = require('../vault') as typeof import('../vault');
    await vault.saveState('u1', withAccount());
    await vault.saveState('u2', createEmpty());
    const blob1 = (await AsyncStorage.getItem('baiu:vault:v3:u1'))!;
    await AsyncStorage.setItem('baiu:vault:v3:u2', blob1);
    jest.resetModules();
    const fresh = require('../vault') as typeof import('../vault');
    expect((await fresh.loadState('u2')).status).toBe('unreadable');
  });

  it('a primeira conta adota os dados da versão sem login', async () => {
    const key = random(32);
    secure.set('baiu.vault.key.v1', toBase64(key));
    await AsyncStorage.setItem('baiu:vault:v2', encryptString(JSON.stringify(withAccount()), key, random(24)));
    const vault = require('../vault') as typeof import('../vault');
    const r = await vault.loadState('u1');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.state.accounts[0].balance).toBe(1234.5);
    expect(await AsyncStorage.getItem('baiu:vault:v2')).toBeNull();
    expect(secure.has('baiu.vault.key.v1')).toBe(false);
    // a segunda conta não vê nada
    expect((await vault.loadState('u2')).status).toBe('empty');
  });

  it('dados de exemplo antigos não são adotados', async () => {
    const key = random(32);
    secure.set('baiu.vault.key.v1', toBase64(key));
    await AsyncStorage.setItem('baiu:vault:v2', encryptString(JSON.stringify({ ...createDemo(), demo: true }), key, random(24)));
    const vault = require('../vault') as typeof import('../vault');
    expect((await vault.loadState('u1')).status).toBe('empty');
  });

  it('depois de excluir a conta, nenhuma gravação atrasada recria o cofre', async () => {
    const vault = require('../vault') as typeof import('../vault');
    await vault.saveState('u1', withAccount());
    vault.blockSaves('u1', true);
    await vault.saveState('u1', withAccount());
    await vault.wipeVault('u1', { forever: true });
    await vault.saveState('u1', withAccount());
    expect(await AsyncStorage.getItem('baiu:vault:v3:u1')).toBeNull();
    expect([...secure.keys()].some((k) => k.endsWith('.u1'))).toBe(false);
  });

  it('exclusão que falhou libera as gravações de novo', async () => {
    const vault = require('../vault') as typeof import('../vault');
    vault.blockSaves('u1', true);
    vault.blockSaves('u1', false);
    await vault.saveState('u1', withAccount());
    expect(await AsyncStorage.getItem('baiu:vault:v3:u1')).not.toBeNull();
  });
});

describe('sessão de login cifrada', () => {
  it('guarda o token cifrado e lê de volta', async () => {
    const { sessionStorage } = require('../auth/session-storage') as typeof import('../auth/session-storage');
    const token = JSON.stringify({ access_token: 'eyJ.segredo.123', user: { id: 'u1' } });
    await sessionStorage.setItem('session', token);
    const raw = (await AsyncStorage.getItem('baiu:auth:session'))!;
    expect(raw.startsWith('b1.')).toBe(true);
    expect(raw).not.toContain('segredo');
    expect(await sessionStorage.getItem('session')).toBe(token);
  });

  it('conteúdo alterado invalida a sessão', async () => {
    const { sessionStorage } = require('../auth/session-storage') as typeof import('../auth/session-storage');
    await sessionStorage.setItem('session', '{"a":1}');
    const raw = (await AsyncStorage.getItem('baiu:auth:session'))!;
    await AsyncStorage.setItem('baiu:auth:session', raw.slice(0, -4) + 'AAAA');
    expect(await sessionStorage.getItem('session')).toBeNull();
    expect(await AsyncStorage.getItem('baiu:auth:session')).toBeNull();
  });

  it('sem a chave do aparelho, não há sessão', async () => {
    const { sessionStorage } = require('../auth/session-storage') as typeof import('../auth/session-storage');
    await sessionStorage.setItem('session', '{"a":1}');
    secure.clear();
    jest.resetModules();
    const fresh = require('../auth/session-storage') as typeof import('../auth/session-storage');
    expect(await fresh.sessionStorage.getItem('session')).toBeNull();
  });
});
