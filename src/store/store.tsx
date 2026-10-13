import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { createEmpty } from '@/data/demo';
import type { State } from '@/data/types';
import { computeFolego } from '@/lib/folego';
import { clearReminders, syncReminders } from '@/lib/reminders';
import { loadState, saveState, wipeVault } from '@/lib/vault';
import { reducer, type Action } from './reducer';

type Ctx = {
  state: State;
  hydrated: boolean;
  /** Os dados existem mas não puderam ser lidos (chave perdida ou arquivo corrompido). */
  unreadable: boolean;
  dispatch: (a: Action) => void;
  /** Apaga tudo do aparelho, inclusive a chave, e volta ao início. */
  eraseAll: () => Promise<void>;
};

const StoreContext = createContext<Ctx | null>(null);

const SAVE_DELAY = 250;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createEmpty());
  const [hydrated, setHydrated] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const latest = useRef(state);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // carregar
  useEffect(() => {
    let alive = true;
    loadState()
      .then((res) => {
        if (!alive) return;
        if (res.status === 'ok') dispatch({ type: 'hydrate', state: res.state });
        if (res.status === 'unreadable') setUnreadable(true);
      })
      .catch(() => alive && setUnreadable(true))
      .finally(() => alive && setHydrated(true));
    return () => {
      alive = false;
    };
  }, []);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    saveState(latest.current).catch(() => {
      dirty.current = true;
    });
  }, []);

  // gravar: só depois de carregar, e nunca por cima de dados ilegíveis
  useEffect(() => {
    latest.current = state;
    if (!hydrated || unreadable) return;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  }, [state, hydrated, unreadable, flush]);

  // ao sair do app, grava na hora
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  // lembretes de vencimento
  const { bills } = state;
  const reminders = state.settings.reminders;
  useEffect(() => {
    if (!hydrated || unreadable) return;
    const t = setTimeout(() => {
      syncReminders(bills, reminders).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [bills, reminders, hydrated, unreadable]);

  const eraseAll = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    dirty.current = false;
    await clearReminders().catch(() => {});
    await wipeVault();
    setUnreadable(false);
    dispatch({ type: 'wipe' });
  }, []);

  const value = useMemo(
    () => ({ state, hydrated, unreadable, dispatch, eraseAll }),
    [state, hydrated, unreadable, eraseAll],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore fora do StoreProvider');
  return ctx;
}

export function useFolego() {
  const { state } = useStore();
  return useMemo(() => computeFolego(state), [state]);
}

export function useAccountsById() {
  const { state } = useStore();
  return useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts]);
}
