import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import type { State } from '@/data/types';
import { decryptString, encryptString, fromBase64, KEY_BYTES, NONCE_BYTES, toBase64 } from './crypto';
import { migrate } from './migrate';

/**
 * Cofre local, um por conta. Os dados ficam cifrados no AsyncStorage; a chave
 * de cada conta fica no Keychain (iOS) ou no Keystore (Android), presa a este
 * aparelho e fora de backups. Quem entra com outra conta no mesmo aparelho
 * não consegue ler os dados da anterior.
 */
const KEY_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const keyId = (owner: string) => `baiu.vault.key.v1.${owner.replace(/[^A-Za-z0-9._-]/g, '_')}`;
const dataId = (owner: string) => `baiu:vault:v3:${owner}`;

/** Cofre único da versão 1.0, antes das contas. É adotado pela primeira conta que entrar. */
const LEGACY_KEY_ID = 'baiu.vault.key.v1';
const LEGACY_DATA_ID = 'baiu:vault:v2';
const OLDEST_IDS = ['baiu:state:v1'];

const keys = new Map<string, Uint8Array>();
/** Contas apagadas nesta sessão: nenhuma gravação atrasada pode recriar o cofre. */
const erased = new Set<string>();

async function readKey(id: string): Promise<Uint8Array | null> {
  const stored = await SecureStore.getItemAsync(id, KEY_OPTS);
  if (!stored) return null;
  const key = fromBase64(stored);
  return key.length === KEY_BYTES ? key : null;
}

async function ownerKey(owner: string, create: boolean): Promise<Uint8Array | null> {
  const hit = keys.get(owner);
  if (hit) return hit;
  let key = await readKey(keyId(owner));
  if (!key && create) {
    key = getRandomBytes(KEY_BYTES);
    await SecureStore.setItemAsync(keyId(owner), toBase64(key), KEY_OPTS);
  }
  if (key) keys.set(owner, key);
  return key;
}

export type LoadResult = { status: 'empty' } | { status: 'ok'; state: State } | { status: 'unreadable' };

function open(blob: string, key: Uint8Array): State | null {
  try {
    return migrate(JSON.parse(decryptString(blob, key)));
  } catch {
    return null;
  }
}

/** Traz os dados da versão sem contas para a conta que acabou de entrar. */
async function adoptLegacy(owner: string): Promise<State | null> {
  const blob = await AsyncStorage.getItem(LEGACY_DATA_ID);
  if (!blob) return null;
  const key = await readKey(LEGACY_KEY_ID);
  const state = key ? open(blob, key) : null;
  await AsyncStorage.removeItem(LEGACY_DATA_ID);
  await SecureStore.deleteItemAsync(LEGACY_KEY_ID, KEY_OPTS).catch(() => {});
  if (!state || state.demo || state.accounts.length === 0) return null;
  const adopted = { ...state, onboarded: true };
  await saveState(owner, adopted);
  return adopted;
}

export async function loadState(owner: string): Promise<LoadResult> {
  await AsyncStorage.multiRemove(OLDEST_IDS).catch(() => {});
  const blob = await AsyncStorage.getItem(dataId(owner));
  if (!blob) {
    const adopted = await adoptLegacy(owner).catch(() => null);
    return adopted ? { status: 'ok', state: adopted } : { status: 'empty' };
  }
  const key = await ownerKey(owner, false);
  if (!key) return { status: 'unreadable' };
  const state = open(blob, key);
  return state ? { status: 'ok', state } : { status: 'unreadable' };
}

export async function saveState(owner: string, state: State): Promise<void> {
  if (erased.has(owner)) return;
  const key = (await ownerKey(owner, true))!;
  const blob = encryptString(JSON.stringify(state), key, getRandomBytes(NONCE_BYTES));
  if (erased.has(owner)) return;
  await AsyncStorage.setItem(dataId(owner), blob);
}

/** Apaga os dados e a chave da conta. Uma chave nova é criada na próxima gravação. */
export async function wipeVault(owner: string, opts: { forever?: boolean } = {}): Promise<void> {
  if (opts.forever) erased.add(owner);
  keys.delete(owner);
  await AsyncStorage.removeItem(dataId(owner));
  await SecureStore.deleteItemAsync(keyId(owner), KEY_OPTS);
}

/** Suspende as gravações de uma conta (durante a exclusão dela). */
export function blockSaves(owner: string, on: boolean) {
  if (on) erased.add(owner);
  else erased.delete(owner);
}
