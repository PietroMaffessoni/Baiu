import type { State } from '@/data/types';
import { decryptString, encryptString, fromBase64, KEY_BYTES, NONCE_BYTES, toBase64 } from './crypto';
import { migrate } from './migrate';

/**
 * Versão web, usada só para desenvolvimento e visualização.
 * O navegador não tem Keychain: a chave fica no localStorage. Não é um alvo de produção.
 */
const KEY_ID = 'baiu.vault.key.v1';
const DATA_ID = 'baiu:vault:v2';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function key(create: boolean): Uint8Array | null {
  const stored = localStorage.getItem(KEY_ID);
  if (stored) return fromBase64(stored);
  if (!create) return null;
  const k = random(KEY_BYTES);
  localStorage.setItem(KEY_ID, toBase64(k));
  return k;
}

export type LoadResult = { status: 'empty' } | { status: 'ok'; state: State } | { status: 'unreadable' };

export async function loadState(): Promise<LoadResult> {
  const blob = localStorage.getItem(DATA_ID);
  if (!blob) return { status: 'empty' };
  const k = key(false);
  if (!k) return { status: 'unreadable' };
  try {
    const state = migrate(JSON.parse(decryptString(blob, k)));
    return state ? { status: 'ok', state } : { status: 'unreadable' };
  } catch {
    return { status: 'unreadable' };
  }
}

export async function saveState(state: State): Promise<void> {
  const k = key(true)!;
  localStorage.setItem(DATA_ID, encryptString(JSON.stringify(state), k, random(NONCE_BYTES)));
}

export async function wipeVault(): Promise<void> {
  localStorage.removeItem(DATA_ID);
  localStorage.removeItem(KEY_ID);
}
