import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import { createDemo } from '@/data/demo';
import type { Account, State } from '@/data/types';
import { computeFolego } from '@/lib/folego';

const KEY = 'baiu:state:v1';

type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'onboard' }
  | { type: 'replayWelcome' }
  | { type: 'toggleHide' }
  | { type: 'addAccount'; account: Account }
  | { type: 'removeAccount'; id: string }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'onboard':
      return { ...state, onboarded: true };
    case 'replayWelcome':
      return { ...state, onboarded: false };
    case 'toggleHide':
      return { ...state, hideValues: !state.hideValues };
    case 'addAccount':
      return { ...state, accounts: [...state.accounts, action.account] };
    case 'removeAccount':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.id),
        txs: state.txs.filter((t) => t.accountId !== action.id),
        holdings: state.holdings.filter((h) => h.accountId !== action.id),
        bills: state.bills.filter((b) => b.accountId !== action.id),
      };
    case 'reset':
      return { ...createDemo(), onboarded: state.onboarded };
  }
}

type Ctx = {
  state: State;
  hydrated: boolean;
  dispatch: (a: Action) => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createDemo());
  const [hydrated, setHydrated] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const saved = JSON.parse(raw) as State;
        if (saved?.version === 1) dispatch({ type: 'hydrate', state: saved });
      })
      .catch(() => {
        /* sem dados salvos: segue com a demonstração */
      })
      .finally(() => alive && setHydrated(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  const value = useMemo(() => ({ state, hydrated, dispatch }), [state, hydrated]);
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
