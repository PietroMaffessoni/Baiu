import type { Account, State, Tx } from '@/data/types';
import { addDays, daysBetween, MESES, startOfDay } from './dates';
import { accountTotal, isAporte, isGuardado, round2 } from './ledger';

export type Period = { key: string; label: string; start: Date; end: Date };

/** Últimos 30 dias, incluindo hoje. */
export function last30(now = new Date()): Period {
  const start = addDays(startOfDay(now), -29);
  const end = addDays(startOfDay(now), 1);
  return { key: '30d', label: 'Últimos 30 dias', start, end };
}

/** Mês do calendário. offset 0 = mês atual, -1 = anterior. */
export function monthPeriod(offset: number, now = new Date()): Period {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  const label = `${MESES[start.getMonth()][0].toUpperCase()}${MESES[start.getMonth()].slice(1)} ${start.getFullYear()}`;
  return { key: `m${start.getFullYear()}-${start.getMonth()}`, label, start, end };
}

export function periodsFor(now = new Date(), months = 12): Period[] {
  return [last30(now), ...Array.from({ length: months }, (_, i) => monthPeriod(-i, now))];
}

const inPeriod = (t: Tx, p: { start: Date; end: Date }) => {
  const d = new Date(t.date);
  return d >= p.start && d < p.end;
};

/** Entradas, gastos, aportes e reserva dentro de um período. */
export function flowsIn(state: State, period: { start: Date; end: Date }) {
  const byId = new Map(state.accounts.map((a) => [a.id, a]));
  let entradas = 0;
  let gastos = 0;
  let aportes = 0;
  let guardado = 0;
  for (const t of state.txs) {
    if (!inPeriod(t, period)) continue;
    if (t.kind === 'entrada') entradas += t.amount;
    else if (t.kind === 'saida') gastos += t.amount;
    else if (isAporte(t, byId)) aportes += t.amount;
    else if (isGuardado(t, byId)) guardado += t.amount;
  }
  return { entradas: round2(entradas), gastos: round2(gastos), aportes: round2(aportes), guardado: round2(guardado) };
}

export function balances(state: State) {
  const sum = (kind: Account['kind']) =>
    round2(state.accounts.filter((a) => a.kind === kind).reduce((n, a) => n + accountTotal(a, state.holdings), 0));
  const corrente = sum('corrente');
  const reserva = sum('reserva');
  const investido = sum('investimento');
  const fatura = round2(
    state.accounts.filter((a) => a.kind === 'cartao').reduce((n, a) => n + Math.max(0, a.balance), 0),
  );
  return {
    corrente,
    reserva,
    investido,
    fatura,
    /** Dinheiro disponível nas contas (corrente + reserva). */
    saldo: round2(corrente + reserva),
    patrimonio: round2(corrente + reserva + investido - fatura),
  };
}

/** Saldos atuais e fluxos dos últimos 30 dias. */
export function summarize(state: State, now = new Date()) {
  return { ...balances(state), ...flowsIn(state, last30(now)) };
}

export type DayBar = { key: string; spent: number; earned: boolean; isToday: boolean };

/** Gasto por dia no período, do mais antigo para o mais recente. */
export function dailySpending(state: State, period: { start: Date; end: Date }, now = new Date(), accountId?: string) {
  const days = Math.max(1, daysBetween(period.start, addDays(period.end, -1)) + 1);
  const bars: DayBar[] = Array.from({ length: days }, (_, i) => {
    const d = addDays(period.start, i);
    return { key: d.toDateString(), spent: 0, earned: false, isToday: daysBetween(d, now) === 0 };
  });
  for (const t of state.txs) {
    if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) continue;
    if (!inPeriod(t, period)) continue;
    const i = daysBetween(period.start, new Date(t.date));
    const bar = bars[i];
    if (!bar) continue;
    if (t.kind === 'entrada') bar.earned = true;
    else if (t.kind === 'saida') bar.spent += t.amount;
  }
  return bars;
}

export function sortedTxs(state: State, accountId?: string) {
  return state.txs
    .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Aportes por mês, do mais antigo ao mês atual. */
export function monthlyAportes(state: State, now = new Date(), months = 12) {
  return Array.from({ length: months }, (_, i) => {
    const p = monthPeriod(i - (months - 1), now);
    return { period: p, value: flowsIn(state, p).aportes };
  });
}

/** Rendimento registrado nos ativos durante o mês atual. */
export function monthYield(state: State, now = new Date()) {
  const p = monthPeriod(0, now);
  let total = 0;
  for (const h of state.holdings) {
    for (const y of h.yields) {
      const d = new Date(y.date);
      if (d >= p.start && d < p.end) total += y.amount;
    }
  }
  return round2(total);
}
