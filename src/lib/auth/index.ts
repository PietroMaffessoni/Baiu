import { Platform } from 'react-native';

import { createFakeBackend } from './fake';
import { createSupabaseBackend } from './supabase';
import type { AuthBackend } from './types';

/**
 * O servidor falso só liga em desenvolvimento ou na web, e só com
 * EXPO_PUBLIC_AUTH_FAKE=1. Builds das lojas sempre usam o Supabase.
 */
const useFake = process.env.EXPO_PUBLIC_AUTH_FAKE === '1' && (__DEV__ || Platform.OS === 'web');

export const auth: AuthBackend = useFake ? createFakeBackend({ latencyMs: 250, persist: true }) : createSupabaseBackend();

export * from './types';
