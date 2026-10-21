import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { getSupabaseClient } from '../auth/supabase';
import { SubFailure, type SubscriptionBackend } from './backend';
import { createFakeStore } from './fake';
import { createRevenueCat } from './revenuecat';
import { NO_SUBSCRIPTION } from './types';

/**
 * Apaga o cadastro da pessoa no RevenueCat, pelo servidor (a chave secreta
 * fica lá). Sem a função no servidor, não há cadastro para apagar.
 */
async function forgetOnServer() {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { error } = await client.functions.invoke('subscription', { body: { action: 'forget' } });
    if (error) throw error;
  } catch (e) {
    if (e instanceof FunctionsHttpError) {
      const res = e.context as Response | undefined;
      let code: string | undefined;
      try {
        code = ((await res?.clone().json()) as { error?: string } | undefined)?.error;
      } catch {}
      // função ou chave ausentes no servidor: as assinaturas não estão ligadas, não há cadastro
      if (res?.status === 404 || code === 'not_configured') return;
      throw new SubFailure('store');
    }
    if (e instanceof FunctionsFetchError || (e instanceof TypeError && /network|fetch/i.test(e.message))) {
      throw new SubFailure('network');
    }
    throw new SubFailure('unknown');
  }
}

/** Build sem as chaves das lojas (ou na web): sem cobrança, o app fica liberado. */
function disabled(): SubscriptionBackend {
  const off = async () => {
    throw new SubFailure('not_configured');
  };
  return {
    enabled: false,
    fake: false,
    identify: async () => NO_SUBSCRIPTION,
    refresh: async () => NO_SUBSCRIPTION,
    plans: async () => [],
    purchase: off,
    restore: off,
    manage: async () => {},
    signOut: async () => {},
    onChange: () => () => {},
    forget: forgetOnServer,
  };
}

const useFake = process.env.EXPO_PUBLIC_AUTH_FAKE === '1' && (__DEV__ || Platform.OS === 'web');

/** Chaves públicas do RevenueCat (feitas para ficar no app). A secreta fica só no servidor. */
const key = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const subscriptionBackend: SubscriptionBackend = useFake
  ? createFakeStore({ latencyMs: 300 })
  : key && createRevenueCat
    ? createRevenueCat(key, forgetOnServer)
    : disabled();
