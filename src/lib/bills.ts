import { bankById } from '@/data/banks';
import type { State } from '@/data/types';
import { daysBetween, MESES_CURTOS, startOfDay } from './dates';
import { isOverdue } from './folego';

export type DueItem = {
  key: string;
  kind: 'bill' | 'card';
  title: string;
  amount: number;
  due: Date;
  overdue: boolean;
  billId?: string;
  accountId?: string;
};

/** Próximo vencimento da fatura: este mês se o dia ainda não passou, senão o próximo. */
export function nextCardDue(dueDay: number, now = new Date()) {
  const today = startOfDay(now);
  const last = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  let d = new Date(
    today.getFullYear(),
    today.getMonth(),
    Math.min(dueDay, last(today.getFullYear(), today.getMonth())),
  );
  if (d < today) {
    const y = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const m = (today.getMonth() + 1) % 12;
    d = new Date(y, m, Math.min(dueDay, last(y, m)));
  }
  d.setHours(12);
  return d;
}

/** Boletos a pagar e faturas em aberto, atrasados primeiro. */
export function dueItems(state: State, now = new Date()): DueItem[] {
  const bills: DueItem[] = state.bills
    .filter((b) => !b.paid)
    .map((b) => ({
      key: b.id,
      kind: 'bill',
      title: b.title,
      amount: b.amount,
      due: new Date(b.dueDate),
      overdue: isOverdue(b, now),
      billId: b.id,
      accountId: b.accountId,
    }));
  const cards: DueItem[] = state.accounts
    .filter((a) => a.kind === 'cartao' && a.balance > 0.004 && a.dueDay)
    .map((a) => ({
      key: `card-${a.id}`,
      kind: 'card',
      title: `Fatura ${a.nickname ?? bankById(a.bankId).name}`,
      amount: a.balance,
      due: nextCardDue(a.dueDay!, now),
      overdue: false,
      accountId: a.id,
    }));
  return [...bills, ...cards].sort(
    (a, b) => Number(b.overdue) - Number(a.overdue) || a.due.getTime() - b.due.getTime(),
  );
}

export function dueLabel(due: Date, now = new Date()) {
  const d = daysBetween(now, due);
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  if (d > 1 && d <= 30) return `Vence em ${d} dias`;
  if (d === -1) return 'Venceu ontem';
  if (d < -1) return `Venceu há ${-d} dias`;
  return `Vence ${due.getDate()} ${MESES_CURTOS[due.getMonth()]}`;
}

export function paidLabel(iso: string) {
  const d = new Date(iso);
  return `Pago em ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
}
