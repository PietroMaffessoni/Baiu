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

import { createDemo, createEmpty } from '@/data/demo';
import type { State } from '@/data/types';
import { computeFolego } from '@/lib/folego';
import { clearReminders, syncReminders } from '@/lib/reminders';
import { loadState, saveState, wipeVault } from '@/lib/vault';
import { reducer, type Action } from './reducer';

/**
 * Dono dos dados na tela:
 * - id da conta: dados reais, cifrados no cofre dessa conta;
 * - 'demo': dados de exemplo, só na memória, nunca gravados;
 * - null: ninguém entrou ainda.
 */
export type Owner = string | 'demo' | null;

type Ctx = {
  state: State;
  owner: Owner;
  hydrated: boolean;
  /** Os dados existem mas não puderam ser lidos (chave perdida ou arquivo corrompido). */
  unreadable: boolean;
  dispatch: (a: Action) => void;
  /** Apaga os dados financeiros deste aparelho, inclusive a chave, e recomeça vazio. */
  eraseAll: () => Promise<void>;
};

const StoreContext = createContext<Ctx | null>(null);

const SAVE_DELAY = 250;

function initial(owner: Owner): State {
  if (owner === 'demo') return { ...createDemo(), onboarded: true, demo: true };
  return createEmpty();
}

/** Monte com `key={owner}`: trocar de dono recomeça o estado do zero. */
export function StoreProvider({ owner, children }: { owner: Owner; children: ReactNode }) {
  const persistent = owner !== null && owner !== 'demo';
  const [state, dispatch] = useReducer(reducer, owner, initial);
  const [hydrated, setHydrated] = useState(!persistent);
  const [unreadable, setUnreadable] = useState(false);
  const latest = useRef(state);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // carregar o cofre da conta
  useEffect(() => {
    if (!persistent) return;
    let alive = true;
    loadState(owner)
      .then((res) => {
        if (!alive) return;
        if (res.status === 'ok') dispatch({ type: 'hydrate', state: { ...res.state, onboarded: true } });
        else if (res.status === 'empty') dispatch({ type: 'onboard' });
        else setUnreadable(true);
      })
      .catch(() => alive && setUnreadable(true))
      .finally(() => alive && setHydrated(true));
    return () => {
      alive = false;
    };
  }, [owner, persistent]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current || !persistent) return;
    dirty.current = false;
    saveState(owner, latest.current).catch(() => {
      dirty.current = true;
    });
  }, [owner, persistent]);

  // gravar: só depois de carregar, e nunca por cima de dados ilegíveis
  useEffect(() => {
    latest.current = state;
    if (!persistent || !hydrated || unreadable) return;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  }, [state, hydrated, unreadable, flush, persistent]);

  // ao sair do app ou trocar de conta, grava na hora
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  // lembretes de vencimento: só para dados reais
  const { bills } = state;
  const reminders = state.settings.reminders;
  useEffect(() => {
    if (!persistent || !hydrated || unreadable) return;
    const t = setTimeout(() => {
      syncReminders(bills, reminders).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [bills, reminders, hydrated, unreadable, persistent]);

  const eraseAll = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current = false;
    await clearReminders().catch(() => {});
    if (persistent) await wipeVault(owner);
    setUnreadable(false);
    dispatch({ type: 'wipe' });
    dispatch({ type: 'onboard' });
  }, [owner, persistent]);

  const value = useMemo(
    () => ({ state, owner, hydrated, unreadable, dispatch, eraseAll }),
    [state, owner, hydrated, unreadable, eraseAll],
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
