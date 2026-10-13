import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import type { State } from '@/data/types';
import { decryptString, encryptString, fromBase64, KEY_BYTES, NONCE_BYTES, toBase64 } from './crypto';
import { migrate } from './migrate';

/**
 * Cofre local. Os dados ficam cifrados no AsyncStorage; a chave fica no
 * Keychain (iOS) ou no Keystore (Android), presa a este aparelho e fora de backups.
 */
const KEY_ID = 'baiu.vault.key.v1';
const DATA_ID = 'baiu:vault:v2';
const LEGACY_IDS = ['baiu:state:v1'];
const KEY_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

let cachedKey: Uint8Array | null = null;

async function readKey(): Promise<Uint8Array | null> {
  if (cachedKey) return cachedKey;
  const stored = await SecureStore.getItemAsync(KEY_ID, KEY_OPTS);
  if (!stored) return null;
  const key = fromBase64(stored);
  if (key.length !== KEY_BYTES) return null;
  cachedKey = key;
  return key;
}

async function createKey(): Promise<Uint8Array> {
  const key = getRandomBytes(KEY_BYTES);
  await SecureStore.setItemAsync(KEY_ID, toBase64(key), KEY_OPTS);
  cachedKey = key;
  return key;
}

export type LoadResult = { status: 'empty' } | { status: 'ok'; state: State } | { status: 'unreadable' };

export async function loadState(): Promise<LoadResult> {
  await AsyncStorage.multiRemove(LEGACY_IDS).catch(() => {});
  const blob = await AsyncStorage.getItem(DATA_ID);
  if (!blob) return { status: 'empty' };
  const key = await readKey();
  if (!key) return { status: 'unreadable' };
  try {
    const state = migrate(JSON.parse(decryptString(blob, key)));
    return state ? { status: 'ok', state } : { status: 'unreadable' };
  } catch {
    return { status: 'unreadable' };
  }
}

export async function saveState(state: State): Promise<void> {
  const key = (await readKey()) ?? (await createKey());
  const blob = encryptString(JSON.stringify(state), key, getRandomBytes(NONCE_BYTES));
  await AsyncStorage.setItem(DATA_ID, blob);
}

/** Apaga dados e chave. Uma chave nova é criada na próxima gravação. */
export async function wipeVault(): Promise<void> {
  cachedKey = null;
  await AsyncStorage.multiRemove([DATA_ID, ...LEGACY_IDS]);
  await SecureStore.deleteItemAsync(KEY_ID, KEY_OPTS);
}
