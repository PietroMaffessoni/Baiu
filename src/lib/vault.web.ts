import type { State } from '@/data/types';
import { decryptString, encryptString, fromBase64, KEY_BYTES, NONCE_BYTES, toBase64 } from './crypto';
import { migrate } from './migrate';

/**
 * Versão web, usada só para desenvolvimento e visualização.
 * O navegador não tem Keychain: a chave fica no localStorage. Não é um alvo de produção.
 */
const keyId = (owner: string) => `baiu.vault.key.v1.${owner}`;
const dataId = (owner: string) => `baiu:vault:v3:${owner}`;
const erased = new Set<string>();

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function key(owner: string, create: boolean): Uint8Array | null {
  const stored = localStorage.getItem(keyId(owner));
  if (stored) return fromBase64(stored);
  if (!create) return null;
  const k = random(KEY_BYTES);
  localStorage.setItem(keyId(owner), toBase64(k));
  return k;
}

export type LoadResult = { status: 'empty' } | { status: 'ok'; state: State } | { status: 'unreadable' };

export async function loadState(owner: string): Promise<LoadResult> {
  const blob = localStorage.getItem(dataId(owner));
  if (!blob) return { status: 'empty' };
  const k = key(owner, false);
  if (!k || k.length !== KEY_BYTES) return { status: 'unreadable' };
  try {
    const state = migrate(JSON.parse(decryptString(blob, k)));
    return state ? { status: 'ok', state } : { status: 'unreadable' };
  } catch {
    return { status: 'unreadable' };
  }
}

export async function saveState(owner: string, state: State): Promise<void> {
  if (erased.has(owner)) return;
  const k = key(owner, true)!;
  localStorage.setItem(dataId(owner), encryptString(JSON.stringify(state), k, random(NONCE_BYTES)));
}

export async function wipeVault(owner: string, opts: { forever?: boolean } = {}): Promise<void> {
  if (opts.forever) erased.add(owner);
  localStorage.removeItem(dataId(owner));
  localStorage.removeItem(keyId(owner));
}

/** Suspende as gravações de uma conta (durante a exclusão dela). */
export function blockSaves(owner: string, on: boolean) {
  if (on) erased.add(owner);
  else erased.delete(owner);
}
