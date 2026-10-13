import type { State, Tx } from '@/data/types';
import { addDays, daysBetween, startOfDay } from './dates';

const MOVES_OUT_OF_SPENDING = new Set<Tx['category']>(['reserva', 'investimento']);

/** Números consolidados dos últimos 30 dias e dos saldos atuais. */
export function summarize(state: State, now = new Date()) {
  const since = addDays(startOfDay(now), -29);
  const recent = state.txs.filter((t) => new Date(t.date) >= since);

  let entradas = 0;
  let gastos = 0;
  let aportes = 0;
  let guardado = 0;
  for (const t of recent) {
    if (t.amount > 0) entradas += t.amount;
    else if (t.category === 'investimento') aportes += -t.amount;
    else if (t.category === 'reserva') guardado += -t.amount;
    else if (!MOVES_OUT_OF_SPENDING.has(t.category)) gastos += -t.amount;
  }

  const sum = (kind: string) => state.accounts.filter((a) => a.kind === kind).reduce((n, a) => n + a.balance, 0);
  const corrente = sum('corrente');
  const reserva = sum('reserva');
  const investido = sum('investimento');
  const fatura = sum('cartao');

  return {
    entradas,
    gastos,
    aportes,
    guardado,
    corrente,
    reserva,
    investido,
    fatura,
    /** Dinheiro disponível nas contas (corrente + reserva). */
    saldo: corrente + reserva,
    patrimonio: corrente + reserva + investido - fatura,
  };
}

export type DayBar = { daysAgo: number; spent: number; earned: boolean };

/** Gasto por dia nos últimos 30 dias, do mais antigo para hoje. */
export function dailySpending(state: State, now = new Date(), accountId?: string): DayBar[] {
  const bars: DayBar[] = Array.from({ length: 30 }, (_, i) => ({ daysAgo: 29 - i, spent: 0, earned: false }));
  for (const t of state.txs) {
    if (accountId && t.accountId !== accountId) continue;
    const ago = daysBetween(new Date(t.date), now);
    if (ago < 0 || ago > 29) continue;
    const bar = bars[29 - ago];
    if (t.amount > 0) bar.earned = true;
    else if (!MOVES_OUT_OF_SPENDING.has(t.category)) bar.spent += -t.amount;
  }
  return bars;
}

export function sortedTxs(state: State, accountId?: string) {
  return state.txs
    .filter((t) => !accountId || t.accountId === accountId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
}
