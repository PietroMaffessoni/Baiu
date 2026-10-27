import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { State } from '@/data/types';
import { useStore } from '@/store/store';
import { bankBackend, BankFailure, type BankBackend, type BankErrorCode } from './client';
import { mergeBankSync, type SyncSummary } from './merge';

/**
 * Busca automática no máximo a cada hora, ao abrir ou voltar ao app. A Polp
 * atualiza saldos a cada 2 horas e movimentos a cada 3 (limite do Open
 * Finance): buscar mais vezes só gasta o limite de requisições.
 */
const AUTO_EVERY = 60 * 60_000;

type Status = { running: boolean; error?: BankErrorCode; last?: SyncSummary; at?: number };

let status: Status = { running: false };
const listeners = new Set<() => void>();
const set = (s: Partial<Status>) => {
  status = { ...status, ...s };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Última busca de cada conexão, para o servidor trazer só o que é novo. */
export function sinceOf(state: State) {
  const since: Record<string, string> = {};
  for (const i of state.bank.items) if (i.syncedAt) since[i.id] = i.syncedAt;
  return since;
}

export function useBankStatus() {
  return useSyncExternalStore(subscribe, () => status);
}

export function useBank(backend: BankBackend = bankBackend) {
  const { state, dispatch } = useStore();
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  /** Busca agora. Devolve o resumo (quantos movimentos novos, quantos para conferir). */
  const syncNow = useCallback(async (): Promise<SyncSummary | null> => {
    if (status.running) return null;
    set({ running: true, error: undefined });
    try {
      const payload = await backend.sync(sinceOf(latest.current));
      const at = new Date();
      const summary = mergeBankSync(latest.current, payload, at).summary;
      dispatch({ type: 'bankSync', payload, at: at.toISOString() });
      set({ running: false, last: summary, at: at.getTime() });
      return summary;
    } catch (e) {
      set({ running: false, error: e instanceof BankFailure ? e.code : 'unknown' });
      return null;
    }
  }, [backend, dispatch]);

  const unlink = useCallback(
    async (itemId: string, keep: boolean) => {
      await backend.unlink(itemId);
      dispatch({ type: 'bankUnlink', itemId, keep });
    },
    [backend, dispatch],
  );

  return { syncNow, unlink, backend };
}

/** Mantém os bancos em dia sozinho: ao abrir o app e ao voltar para ele. */
export function useBankUpkeep(enabled: boolean) {
  const { state } = useStore();
  const { syncNow } = useBank();
  const hasItems = state.bank.items.length > 0;
  // a última busca vem dos dados da conta, não da memória: trocar de conta não engana o relógio
  const lastSync = Math.max(0, ...state.bank.items.map((i) => (i.syncedAt ? Date.parse(i.syncedAt) : 0)));

  useEffect(() => {
    if (!enabled || !hasItems) return;
    const maybe = () => {
      if (Date.now() - lastSync > AUTO_EVERY) syncNow();
    };
    const t = setTimeout(maybe, 1200);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && maybe());
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [enabled, hasItems, lastSync, syncNow]);
}
