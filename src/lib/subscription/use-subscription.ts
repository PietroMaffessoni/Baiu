import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { syncTrialReminder } from '@/lib/reminders';
import type { SubscriptionBackend } from './backend';
import { subscriptionBackend } from './client';
import { trialReminderAt } from './status';
import { NO_SUBSCRIPTION, type Entitlement, type Plan } from './types';

/** Sem resposta da loja nesse tempo, o app abre assim mesmo (o servidor confere o que custa dinheiro). */
const WAIT_MS = 5000;

type SubState = {
  userId: string | null;
  /** Já sabe (ou desistiu de esperar) o estado da assinatura. */
  ready: boolean;
  /** null: ainda não sabe, ou a loja não respondeu. */
  ent: Entitlement | null;
  plans: Plan[] | null;
};

let state: SubState = { userId: null, ready: true, ent: null, plans: null };
/** A pessoa foi para a loja gerenciar a assinatura: ao voltar, busca o estado sem cache. */
let managing = false;
const listeners = new Set<() => void>();
const set = (s: Partial<SubState>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSubscriptionState() {
  return useSyncExternalStore(subscribe, () => state);
}

/** Assinatura ligada neste build, estado conhecido e sem direito de uso. */
export function isLocked(s: SubState, enabled = subscriptionBackend.enabled) {
  return enabled && s.userId !== null && s.ready && s.ent !== null && !s.ent.active;
}

/**
 * Liga a assinatura à conta que entrou, acompanha mudanças (compra,
 * renovação, cancelamento feito na loja) e agenda o aviso do fim do mês
 * grátis. `userId` null: ninguém entrou, ou é o modo exemplo.
 */
export function useSubscriptionUpkeep(
  userId: string | null,
  trialReminder: boolean,
  backend: SubscriptionBackend = subscriptionBackend,
) {
  useEffect(() => {
    if (!userId) {
      if (state.userId) backend.signOut().catch(() => {});
      set({ userId: null, ready: true, ent: null, plans: null });
      return;
    }
    if (!backend.enabled) {
      set({ userId, ready: true, ent: null, plans: null });
      return;
    }
    let alive = true;
    set({ userId, ready: false, ent: null, plans: null });
    const timer = setTimeout(() => alive && set({ ready: true }), WAIT_MS);
    backend
      .identify(userId)
      .then((ent) => alive && set({ ent, ready: true }))
      .catch(() => alive && set({ ready: true }))
      .finally(() => clearTimeout(timer));
    const off = backend.onChange((ent) => alive && set({ ent }));
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const force = managing;
      managing = false;
      backend
        .refresh(force)
        .then((ent) => alive && set({ ent }))
        .catch(() => {});
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      off();
      sub.remove();
    };
  }, [userId, backend]);

  const s = useSubscriptionState();
  const remindAt = trialReminder && s.ent ? trialReminderAt(s.ent) : null;
  const remindMs = remindAt?.getTime() ?? null;
  const until = s.ent?.until ?? null;
  useEffect(() => {
    if (!userId || !backend.enabled) return;
    const at = remindMs ? new Date(remindMs) : null;
    const days = at && until ? Math.round((Date.parse(until) - at.getTime()) / 86_400_000) : 0;
    syncTrialReminder(at, days).catch(() => {});
  }, [userId, backend, remindMs, until]);

  // até o efeito ligar a conta nova, o estado ainda é o da anterior
  const current = !userId || !backend.enabled || s.userId === userId;
  return { ready: current && s.ready, locked: current && isLocked(s, backend.enabled) };
}

/** Ações da tela de assinatura. */
export function useSubscription(backend: SubscriptionBackend = subscriptionBackend) {
  const s = useSubscriptionState();

  const loadPlans = useCallback(async () => {
    const plans = await backend.plans();
    set({ plans });
    return plans;
  }, [backend]);

  const purchase = useCallback(
    async (planId: string) => {
      const ent = await backend.purchase(planId);
      set({ ent });
      return ent;
    },
    [backend],
  );

  const restore = useCallback(async () => {
    const ent = await backend.restore();
    set({ ent });
    return ent;
  }, [backend]);

  /** Cancelar, reativar ou trocar o pagamento: tudo acontece na loja. */
  const manage = useCallback(async () => {
    managing = true;
    await backend.manage(state.ent ?? NO_SUBSCRIPTION);
    if (backend.fake) {
      managing = false;
      set({ ent: await backend.refresh(true) });
    }
  }, [backend]);

  return {
    ...s,
    enabled: backend.enabled,
    fake: backend.fake,
    loadPlans,
    purchase,
    restore,
    manage,
    forget: () => backend.forget(),
  };
}
