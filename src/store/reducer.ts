import { createDemo, createEmpty } from '@/data/demo';
import type { Account, Bill, Holding, Settings, State, Tx } from '@/data/types';
import { isBaiuColor, type BaiuLook } from '@/lib/look';
import { computeFolego } from '@/lib/folego';
import { applyTx, newId, round2, validateTx } from '@/lib/ledger';
import { newlyEarned } from '@/lib/seals';

export type HoldingOrigin =
  /** Já existia antes do Baiu: entra sem movimento. */
  | { type: 'existente' }
  /** Dinheiro parado na própria corretora. */
  | { type: 'saldo' }
  /** Transferência de outra conta (conta como aporte). */
  | { type: 'conta'; accountId: string };

export type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'onboard' }
  | { type: 'loadDemo' }
  | { type: 'exitDemo' }
  | { type: 'wipe' }
  | { type: 'setSetting'; key: keyof Settings; value: boolean }
  | { type: 'setBaiu'; patch: Partial<BaiuLook> }
  | { type: 'addAccount'; account: Account }
  | { type: 'updateAccount'; id: string; patch: Partial<Pick<Account, 'nickname' | 'balance' | 'dueDay' | 'limit'>> }
  | { type: 'removeAccount'; id: string }
  | { type: 'addTx'; tx: Tx }
  | { type: 'updateTx'; tx: Tx }
  | { type: 'removeTx'; id: string }
  | { type: 'addBill'; bill: Bill }
  | { type: 'updateBill'; bill: Bill }
  | { type: 'removeBill'; id: string }
  | { type: 'payBill'; id: string; accountId: string; date: string }
  | { type: 'addHolding'; holding: Holding; origin: HoldingOrigin }
  | { type: 'holdingValue'; id: string; value: number; date: string }
  | { type: 'holdingApply'; id: string; amount: number; origin: HoldingOrigin; date: string }
  | { type: 'holdingRedeem'; id: string; amount: number; toAccountId?: string; date: string }
  | { type: 'renameHolding'; id: string; name: string; kind: Holding['kind'] }
  | { type: 'removeHolding'; id: string };

const byIdOf = (s: State) => new Map(s.accounts.map((a) => [a.id, a]));

function addMonth(iso: string) {
  const d = new Date(iso);
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1, d.getHours(), d.getMinutes());
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return next.toISOString();
}

function withTx(s: State, tx: Tx): State {
  if (validateTx(tx, byIdOf(s))) return s;
  return { ...s, txs: [...s.txs, tx], accounts: applyTx(s.accounts, tx, 1) };
}

function withoutTx(s: State, id: string): State {
  const tx = s.txs.find((t) => t.id === id);
  if (!tx) return s;
  return { ...s, txs: s.txs.filter((t) => t.id !== id), accounts: applyTx(s.accounts, tx, -1) };
}

/** Transferência para a corretora quando o dinheiro vem de outra conta. */
function fundFromOrigin(
  s: State,
  investAccountId: string,
  amount: number,
  origin: HoldingOrigin,
  date: string,
  name: string,
) {
  if (origin.type !== 'conta') return s;
  const tx: Tx = {
    id: newId('t'),
    kind: 'transferencia',
    accountId: origin.accountId,
    toAccountId: investAccountId,
    amount: round2(amount),
    description: `Aplicação em ${name}`.slice(0, 80),
    category: 'transferencia',
    date,
    createdAt: new Date().toISOString(),
  };
  return withTx(s, tx);
}

/** O saldo parado na corretora cobre a aplicação? */
function cashCovers(s: State, accountId: string, amount: number, origin: HoldingOrigin) {
  if (origin.type !== 'saldo') return true;
  const a = s.accounts.find((x) => x.id === accountId);
  return !!a && a.balance + 0.001 >= amount;
}

function takeCash(s: State, accountId: string, amount: number, origin: HoldingOrigin): State {
  if (origin.type === 'existente') return s;
  return {
    ...s,
    accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, balance: round2(a.balance - amount) } : a)),
  };
}

function core(s: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'onboard':
      return { ...s, onboarded: true };
    case 'loadDemo':
      return { ...createDemo(), onboarded: true, settings: s.settings, baiu: s.baiu };
    case 'exitDemo':
      return { ...createEmpty(), onboarded: true, settings: { ...s.settings }, baiu: { ...s.baiu } };
    case 'wipe':
      return createEmpty();
    case 'setSetting':
      return { ...s, settings: { ...s.settings, [action.key]: action.value } };
    case 'setBaiu': {
      const { color, seasonal } = action.patch;
      if (color !== undefined && !isBaiuColor(color)) return s;
      return {
        ...s,
        baiu: {
          color: color ?? s.baiu.color,
          seasonal: typeof seasonal === 'boolean' ? seasonal : s.baiu.seasonal,
        },
      };
    }

    case 'addAccount': {
      const a = action.account;
      if (!a.id || s.accounts.some((x) => x.id === a.id)) return s;
      return { ...s, accounts: [...s.accounts, { ...a, balance: round2(a.balance) }] };
    }
    case 'updateAccount':
      return {
        ...s,
        accounts: s.accounts.map((a) =>
          a.id === action.id
            ? {
                ...a,
                ...action.patch,
                balance: action.patch.balance !== undefined ? round2(action.patch.balance) : a.balance,
              }
            : a,
        ),
      };
    case 'removeAccount': {
      const id = action.id;
      return {
        ...s,
        accounts: s.accounts.filter((a) => a.id !== id),
        txs: s.txs.filter((t) => t.accountId !== id && t.toAccountId !== id),
        holdings: s.holdings.filter((h) => h.accountId !== id),
        bills: s.bills.map((b) => (b.accountId === id ? { ...b, accountId: undefined } : b)),
      };
    }

    case 'addTx': {
      const next = withTx(s, action.tx);
      if (next === s || !action.tx.billId) return next;
      return {
        ...next,
        bills: next.bills.map((b) =>
          b.id === action.tx.billId ? { ...b, paid: true, paidAt: action.tx.date, paidTxId: action.tx.id } : b,
        ),
      };
    }
    case 'updateTx': {
      const old = s.txs.find((t) => t.id === action.tx.id);
      if (!old) return s;
      const without = withoutTx(s, old.id);
      const next = withTx(without, { ...action.tx, billId: old.billId, createdAt: old.createdAt });
      if (next === without) return s;
      if (!old.billId) return next;
      // a data do pagamento acompanha o movimento editado
      return {
        ...next,
        bills: next.bills.map((b) => (b.id === old.billId && b.paid ? { ...b, paidAt: action.tx.date } : b)),
      };
    }
    case 'removeTx': {
      const tx = s.txs.find((t) => t.id === action.id);
      const next = withoutTx(s, action.id);
      if (!tx?.billId) return next;
      // vencimento original já apagado: o do mês seguinte agora é independente e fica
      if (!next.bills.some((b) => b.id === tx.billId)) return next;
      // desfazer o pagamento volta o vencimento para "a pagar" e tira a recorrência gerada
      return {
        ...next,
        bills: next.bills
          .filter((b) => !(b.fromBillId === tx.billId && !b.paid))
          .map((b) => (b.id === tx.billId ? { ...b, paid: false, paidAt: undefined, paidTxId: undefined } : b)),
      };
    }

    case 'addBill':
      if (!(action.bill.amount > 0) || !action.bill.title.trim()) return s;
      return { ...s, bills: [...s.bills, action.bill] };
    case 'updateBill':
      return { ...s, bills: s.bills.map((b) => (b.id === action.bill.id ? action.bill : b)) };
    case 'removeBill':
      return { ...s, bills: s.bills.filter((b) => b.id !== action.id) };
    case 'payBill': {
      const bill = s.bills.find((b) => b.id === action.id);
      if (!bill || bill.paid) return s;
      const tx: Tx = {
        id: newId('t'),
        kind: 'saida',
        accountId: action.accountId,
        amount: bill.amount,
        description: bill.title.slice(0, 80),
        category: bill.category,
        method: s.accounts.find((a) => a.id === action.accountId)?.kind === 'cartao' ? 'cartao' : 'boleto',
        date: action.date,
        billId: bill.id,
        createdAt: new Date().toISOString(),
      };
      const paid = withTx(s, tx);
      if (paid === s) return s;
      let bills = paid.bills.map((b) =>
        b.id === bill.id ? { ...b, paid: true, paidAt: action.date, paidTxId: tx.id } : b,
      );
      if (bill.repeatMonthly) {
        bills = [
          ...bills,
          {
            ...bill,
            id: newId('b'),
            dueDate: addMonth(bill.dueDate),
            paid: false,
            paidAt: undefined,
            paidTxId: undefined,
            fromBillId: bill.id,
            createdAt: new Date().toISOString(),
          },
        ];
      }
      return { ...paid, bills };
    }

    case 'addHolding': {
      const h = action.holding;
      if (!(h.value >= 0) || !(h.invested >= 0) || !h.name.trim()) return s;
      if (!s.accounts.some((a) => a.id === h.accountId && a.kind === 'investimento')) return s;
      if (!cashCovers(s, h.accountId, h.invested, action.origin)) return s;
      const funded = fundFromOrigin(s, h.accountId, h.invested, action.origin, h.createdAt, h.name);
      if (action.origin.type === 'conta' && funded === s) return s;
      const paid = takeCash(funded, h.accountId, h.invested, action.origin);
      return { ...paid, holdings: [...paid.holdings, { ...h, value: round2(h.value), invested: round2(h.invested) }] };
    }
    case 'holdingValue': {
      return {
        ...s,
        holdings: s.holdings.map((h) => {
          if (h.id !== action.id) return h;
          const delta = round2(action.value - h.value);
          return {
            ...h,
            value: round2(action.value),
            yields: delta === 0 ? h.yields : [...h.yields, { date: action.date, amount: delta }],
          };
        }),
      };
    }
    case 'holdingApply': {
      const h = s.holdings.find((x) => x.id === action.id);
      if (!h || !(action.amount > 0)) return s;
      if (!cashCovers(s, h.accountId, action.amount, action.origin)) return s;
      const funded = fundFromOrigin(s, h.accountId, action.amount, action.origin, action.date, h.name);
      if (action.origin.type === 'conta' && funded === s) return s;
      const paid = takeCash(funded, h.accountId, action.amount, action.origin);
      return {
        ...paid,
        holdings: paid.holdings.map((x) =>
          x.id === h.id
            ? { ...x, value: round2(x.value + action.amount), invested: round2(x.invested + action.amount) }
            : x,
        ),
      };
    }
    case 'holdingRedeem': {
      const h = s.holdings.find((x) => x.id === action.id);
      if (!h || !(action.amount > 0) || action.amount > h.value + 0.001) return s;
      const share = h.value > 0 ? action.amount / h.value : 1;
      let next: State = {
        ...s,
        holdings: s.holdings.map((x) =>
          x.id === h.id
            ? { ...x, value: round2(x.value - action.amount), invested: round2(x.invested * (1 - share)) }
            : x,
        ),
        accounts: s.accounts.map((a) =>
          a.id === h.accountId ? { ...a, balance: round2(a.balance + action.amount) } : a,
        ),
      };
      if (action.toAccountId) {
        next = withTx(next, {
          id: newId('t'),
          kind: 'transferencia',
          accountId: h.accountId,
          toAccountId: action.toAccountId,
          amount: round2(action.amount),
          description: `Resgate de ${h.name}`.slice(0, 80),
          category: 'transferencia',
          date: action.date,
          createdAt: new Date().toISOString(),
        });
      }
      return next;
    }
    case 'renameHolding':
      if (!action.name.trim()) return s;
      return {
        ...s,
        holdings: s.holdings.map((h) =>
          h.id === action.id ? { ...h, name: action.name.trim().slice(0, 60), kind: action.kind } : h,
        ),
      };
    case 'removeHolding':
      return { ...s, holdings: s.holdings.filter((h) => h.id !== action.id) };
  }
}

/** Aplica a ação e carimba os selos que passaram a valer. */
export function reducer(s: State, action: Action): State {
  const next = core(s, action);
  if (next === s || action.type === 'hydrate' || action.type === 'wipe' || !next.onboarded) return next;
  const now = new Date();
  const earned = newlyEarned(next, computeFolego(next, now), now);
  if (earned.length === 0) return next;
  const seals = { ...next.seals };
  for (const id of earned) seals[id] = now.toISOString();
  return { ...next, seals };
}
