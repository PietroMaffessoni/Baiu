import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { decryptString, encryptString, fromBase64, KEY_BYTES, NONCE_BYTES, toBase64 } from '../crypto';

/**
 * Onde a sessão de login fica guardada. Os tokens são cifrados com
 * XChaCha20-Poly1305; a chave fica no Keychain/Keystore, só neste aparelho.
 * O Keychain do Android limita o tamanho de cada item, por isso o texto
 * cifrado vai para o AsyncStorage e só a chave fica no cofre do sistema.
 */
const KEY_ID = 'baiu.auth.key.v1';
const PREFIX = 'baiu:auth:';
const KEY_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

let cached: Uint8Array | null = null;

async function key(create: boolean): Promise<Uint8Array | null> {
  if (cached) return cached;
  const stored = await SecureStore.getItemAsync(KEY_ID, KEY_OPTS);
  if (stored) {
    const k = fromBase64(stored);
    if (k.length === KEY_BYTES) return (cached = k);
  }
  if (!create) return null;
  const k = getRandomBytes(KEY_BYTES);
  await SecureStore.setItemAsync(KEY_ID, toBase64(k), KEY_OPTS);
  return (cached = k);
}

export const sessionStorage = {
  async getItem(name: string): Promise<string | null> {
    const blob = await AsyncStorage.getItem(PREFIX + name);
    if (!blob) return null;
    const k = await key(false);
    if (!k) return null;
    try {
      return decryptString(blob, k);
    } catch {
      // chave trocada ou conteúdo alterado: a sessão não vale mais
      await AsyncStorage.removeItem(PREFIX + name);
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    const k = (await key(true))!;
    await AsyncStorage.setItem(PREFIX + name, encryptString(value, k, getRandomBytes(NONCE_BYTES)));
  },
  async removeItem(name: string): Promise<void> {
    await AsyncStorage.removeItem(PREFIX + name);
  },
};
