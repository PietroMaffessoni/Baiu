import type { Account, Bill, Category, Holding, HoldingKind, State, Tx } from '@/data/types';
import { groupKey, normalize } from '../assistant/insights';
import { addMonth } from '../dates';
import { newId, round2, validateTx } from '../ledger';
import { categorize, ruleKey, tidyDescription, type Internal } from './categorize';
import type { RemoteAccount, RemoteInvestment, RemoteItem, SyncPayload } from './types';

/**
 * Junta o que veio do banco com o que já está no aparelho, sem duplicar:
 * contas e saldos vêm do banco; movimentos novos entram já categorizados;
 * transferências entre contas da própria pessoa viram uma transferência só;
 * vencimentos cadastrados são marcados como pagos quando o pagamento aparece.
 */

const BANK_NAMES: [RegExp, string][] = [
  [/nubank|nu pagamentos/, 'nubank'],
  [/itau/, 'itau'],
  [/inter\b/, 'inter'],
  [/caixa/, 'caixa'],
  [/banco do brasil|\bbb\b/, 'bb'],
  [/bradesco/, 'bradesco'],
  [/santander/, 'santander'],
  [/\bc6\b/, 'c6'],
  [/picpay/, 'picpay'],
  [/mercado ?pago/, 'mercadopago'],
  [/\bxp\b/, 'xp'],
  [/btg/, 'btg'],
  [/\brico\b/, 'rico'],
  [/sicredi/, 'sicredi'],
  [/\bneon\b/, 'neon'],
];

export function bankIdFor(name: string) {
  const n = normalize(name);
  return BANK_NAMES.find(([re]) => re.test(n))?.[1] ?? 'outro';
}

export function itemStatus(s: RemoteItem['status']) {
  if (s === 'UPDATED') return 'ok' as const;
  if (s === 'UPDATING') return 'atualizando' as const;
  if (s === 'LOGIN_ERROR' || s === 'WAITING_USER_INPUT') return 'reconectar' as const;
  return 'erro' as const;
}

const HOLDING_KIND: [RegExp, HoldingKind][] = [
  [/TREASURY/, 'Tesouro'],
  [/^CDB$|^LC$|^LF$|^LIG$/, 'CDB'],
  [/^LCI$|^LCA$|^CRI$|^CRA$/, 'LCI/LCA'],
  [/REAL_ESTATE_FUND/, 'FII'],
  [/^ETF/, 'ETF'],
  [/STOCK|BDR|DERIVATIVES|OPTION/, 'Ações'],
  [/RETIREMENT|PGBL|VGBL|SECURITY/, 'Previdência'],
  [/FUND|MUTUAL/, 'Fundo'],
];

function holdingKind(inv: RemoteInvestment): HoldingKind {
  const key = `${inv.subtype ?? ''}`.toUpperCase();
  for (const [re, k] of HOLDING_KIND) if (re.test(key)) return k;
  const type = inv.type.toUpperCase();
  for (const [re, k] of HOLDING_KIND) if (re.test(type)) return k;
  if (type === 'FIXED_INCOME') return 'CDB';
  return 'Outro';
}

const dayOf = (yyyyMmDd?: string | null) => {
  const m = /^\d{4}-\d{2}-(\d{2})/.exec(yyyyMmDd ?? '');
  return m ? Number(m[1]) : undefined;
};

function accountFromRemote(ra: RemoteAccount, bankId: string, institution: string, now: string): Account {
  const card = ra.type === 'CREDIT';
  // banco fora da lista do app: o nome vem da instituição, não "Outra instituição"
  const own = bankId === 'outro' ? institution.slice(0, 30) : undefined;
  return {
    id: newId('a'),
    bankId,
    kind: card ? 'cartao' : ra.subtype === 'SAVINGS_ACCOUNT' ? 'reserva' : 'corrente',
    nickname: card ? ra.name.slice(0, 30) || 'Cartão' : ra.subtype === 'SAVINGS_ACCOUNT' ? 'Poupança' : own,
    balance: card ? round2(Math.max(0, ra.balance)) : round2(ra.balance),
    limit: card && ra.creditLimit ? round2(ra.creditLimit) : undefined,
    dueDay: card ? dayOf(ra.dueDate) : undefined,
    link: { item: ra.itemId, remote: ra.id, last4: ra.last4 ?? undefined },
    createdAt: now,
  };
}

export type SyncSummary = {
  /** Movimentos novos. */
  added: number;
  /** Quantos deles pedem um olhar da pessoa. */
  review: number;
  accounts: number;
  investments: number;
  /** Vencimentos marcados como pagos automaticamente. */
  paidBills: number;
};

const DAY = 86_400_000;
const near = (a: string, b: string, days: number) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= days * DAY;
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.011;

export function mergeBankSync(s: State, p: SyncPayload, now = new Date()): { state: State; summary: SyncSummary } {
  const at = now.toISOString();
  const summary: SyncSummary = { added: 0, review: 0, accounts: 0, investments: 0, paidBills: 0 };

  // conexões
  const items = [...s.bank.items];
  for (const ri of p.items) {
    const i = items.findIndex((x) => x.id === ri.id);
    const prev = i >= 0 ? items[i] : undefined;
    const next = {
      id: ri.id,
      name: ri.name,
      bankId: bankIdFor(ri.name),
      status: itemStatus(ri.status),
      updatedAt: ri.updatedAt ?? prev?.updatedAt,
      syncedAt: at,
      connectedAt: prev?.connectedAt ?? at,
    };
    if (i >= 0) items[i] = next;
    else items.push(next);
  }
  const bankOf = (itemId: string) => items.find((x) => x.id === itemId)?.bankId ?? 'outro';
  const nameOf = (itemId: string) => items.find((x) => x.id === itemId)?.name ?? 'Banco';

  // contas: saldo, limite e vencimento sempre do banco
  let accounts = [...s.accounts];
  const remoteType = new Map<string, 'BANK' | 'CREDIT'>();
  for (const ra of p.accounts) {
    if (s.bank.hiddenAccounts[ra.id]) continue;
    remoteType.set(ra.id, ra.type);
    const idx = accounts.findIndex((a) => a.link?.remote === ra.id);
    if (idx < 0) {
      accounts.push(accountFromRemote(ra, bankOf(ra.itemId), nameOf(ra.itemId), at));
      summary.accounts++;
      continue;
    }
    const a = accounts[idx];
    const card = a.kind === 'cartao';
    accounts[idx] = {
      ...a,
      balance: card ? round2(Math.max(0, ra.balance)) : round2(ra.balance),
      limit: card && ra.creditLimit ? round2(ra.creditLimit) : a.limit,
      dueDay: card ? (dayOf(ra.dueDate) ?? a.dueDay) : a.dueDay,
    };
  }

  // investimentos: uma carteira por conexão
  const invAccount = (itemId: string) => {
    const remote = `inv:${itemId}`;
    if (s.bank.hiddenAccounts[remote]) return null;
    let a = accounts.find((x) => x.link?.remote === remote);
    if (!a) {
      a = {
        id: newId('a'),
        bankId: bankOf(itemId),
        nickname: bankOf(itemId) === 'outro' ? nameOf(itemId).slice(0, 30) : undefined,
        kind: 'investimento',
        balance: 0,
        link: { item: itemId, remote },
        createdAt: at,
      };
      accounts.push(a);
      summary.accounts++;
    }
    return a;
  };
  let holdings = [...s.holdings];
  const invItems = new Set(p.investments.map((i) => i.itemId));
  for (const itemId of invItems) {
    const acc = invAccount(itemId);
    if (!acc) continue;
    const remoteIds = new Set<string>();
    for (const inv of p.investments.filter((i) => i.itemId === itemId)) {
      remoteIds.add(inv.id);
      const value = round2(Math.max(0, inv.balance));
      const idx = holdings.findIndex((h) => h.ext?.id === inv.id);
      if (idx < 0) {
        const h: Holding = {
          id: newId('h'),
          accountId: acc.id,
          name: inv.name.slice(0, 60) || 'Investimento',
          kind: holdingKind(inv),
          value,
          invested: round2(inv.invested && inv.invested > 0 ? inv.invested : value),
          yields: [],
          ext: { id: inv.id, item: itemId },
          createdAt: at,
        };
        holdings.push(h);
        summary.investments++;
        continue;
      }
      const h = holdings[idx];
      const delta = round2(value - h.value);
      holdings[idx] = {
        ...h,
        value,
        invested: inv.invested && inv.invested > 0 ? round2(inv.invested) : h.invested,
        yields: delta === 0 ? h.yields : [...h.yields, { date: at, amount: delta }],
      };
    }
    // resgatado por inteiro: sai da carteira
    holdings = holdings.filter((h) => h.ext?.item !== itemId || remoteIds.has(h.ext.id));
  }

  // movimentos
  const byRemote = new Map(accounts.filter((a) => a.link).map((a) => [a.link!.remote, a]));
  const known = new Set(s.txs.filter((t) => t.ext).map((t) => t.ext!.id));
  const ignored = { ...s.bank.ignored };
  const internal = new Map<string, Internal>();
  const fresh: Tx[] = [];
  for (const rt of [...p.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (known.has(rt.id) || ignored[rt.id]) continue;
    const acc = byRemote.get(rt.accountId);
    const type = remoteType.get(rt.accountId);
    if (!acc || !type) continue;
    const g = categorize(rt, type, s.bank.rules);
    const tx: Tx = {
      id: newId('t'),
      kind: g.kind,
      accountId: acc.id,
      amount: round2(Math.abs(rt.amount)),
      description: tidyDescription(rt.description),
      category: g.category,
      method: type === 'CREDIT' ? 'cartao' : methodOf(rt.operationType),
      date: new Date(rt.date).toISOString(),
      ext: { id: rt.id, item: acc.link!.item },
      review: g.review || undefined,
      catBy: g.by,
      createdAt: at,
    };
    if (!(tx.amount > 0) || Number.isNaN(new Date(tx.date).getTime())) continue;
    if (g.internal) internal.set(tx.id, g.internal);
    fresh.push(tx);
    known.add(rt.id);
  }

  // aplicação e resgate: viram transferência com a carteira da mesma conexão
  const out: Tx[] = [];
  for (const tx of fresh) {
    const kind = internal.get(tx.id);
    if (kind === 'aplicacao' || kind === 'resgate') {
      const inv = invAccount(tx.ext!.item);
      if (inv) {
        out.push({
          ...tx,
          kind: 'transferencia',
          accountId: kind === 'aplicacao' ? tx.accountId : inv.id,
          toAccountId: kind === 'aplicacao' ? inv.id : tx.accountId,
          category: 'transferencia',
          review: undefined,
        });
        internal.delete(tx.id);
        continue;
      }
    }
    out.push(tx);
  }

  // pares: a saída de uma conta e a entrada em outra, mesmo valor, até 3 dias
  const pool = [...s.txs.filter((t) => t.ext && t.category === 'transferencia' && t.kind !== 'transferencia'), ...out];
  const used = new Set<string>();
  const merged = new Map<string, Tx>();
  for (const debit of pool) {
    if (debit.kind !== 'saida' || debit.category !== 'transferencia' || used.has(debit.id)) continue;
    const credit = pool.find(
      (c) =>
        c.kind === 'entrada' &&
        c.category === 'transferencia' &&
        !used.has(c.id) &&
        c.accountId !== debit.accountId &&
        sameAmount(c.amount, debit.amount) &&
        near(c.date, debit.date, 3),
    );
    if (!credit) continue;
    used.add(debit.id);
    used.add(credit.id);
    merged.set(debit.id, {
      ...debit,
      kind: 'transferencia',
      toAccountId: credit.accountId,
      review: undefined,
    });
    ignored[credit.ext!.id] = true;
  }

  // fatura paga de um cartão que não está no Baiu: foi gasto de verdade
  const hasCard = accounts.some((a) => a.kind === 'cartao');
  const settled = out
    .filter((t) => !used.has(t.id) || merged.has(t.id))
    .map((t) => merged.get(t.id) ?? t)
    .map((t) =>
      internal.get(t.id) === 'fatura' &&
      t.kind === 'saida' &&
      t.category === 'transferencia' &&
      !hasCard &&
      !merged.has(t.id)
        ? { ...t, category: 'outros' as Category, review: true, catBy: 'baiu' as const }
        : t,
    );
  const keep = s.txs.filter((t) => !used.has(t.id) || merged.has(t.id)).map((t) => merged.get(t.id) ?? t);

  // salário que se repete: mesma origem, todo mês, valor parecido
  const all = [...keep, ...settled];
  const salaryKeys = recurringIncome(all);
  const byIdOf = new Map(accounts.map((a) => [a.id, a]));
  const finalNew = settled
    .map((t) =>
      t.kind === 'entrada' &&
      t.catBy !== 'pessoa' &&
      t.catBy !== 'aprendida' &&
      t.review &&
      salaryKeys.has(ruleKey(t.description) ?? '')
        ? { ...t, category: 'salario' as Category, review: undefined, catBy: 'baiu' as const }
        : t,
    )
    .filter((t) => validateTx(t, byIdOf) === null);

  // vencimentos pagos
  let bills = [...s.bills];
  for (const t of finalNew) {
    if (t.kind !== 'saida' || t.category === 'transferencia' || t.billId) continue;
    const bill = matchBill(bills, t);
    if (!bill) continue;
    t.billId = bill.id;
    bills = bills.map((b) => (b.id === bill.id ? { ...b, paid: true, paidAt: t.date, paidTxId: t.id } : b));
    if (bill.repeatMonthly) {
      bills.push({
        ...bill,
        id: newId('b'),
        dueDate: addMonth(bill.dueDate),
        paid: false,
        paidAt: undefined,
        paidTxId: undefined,
        fromBillId: bill.id,
        createdAt: at,
      });
    }
    summary.paidBills++;
  }

  summary.added = finalNew.length;
  summary.review = finalNew.filter((t) => t.review).length;

  return {
    state: {
      ...s,
      accounts,
      holdings,
      bills,
      txs: [...keep, ...finalNew],
      bank: { ...s.bank, items, ignored },
    },
    summary,
  };
}

function methodOf(op?: string | null): Tx['method'] {
  switch ((op ?? '').toUpperCase()) {
    case 'PIX':
      return 'pix';
    case 'TED':
    case 'DOC':
    case 'TRANSFERENCIA_MESMA_INSTITUICAO':
      return 'ted';
    case 'BOLETO':
    case 'CONVENIO_ARRECADACAO':
      return 'boleto';
    case 'CARTAO':
      return 'debito';
    case 'SAQUE':
    case 'DEPOSITO':
      return 'dinheiro';
    default:
      return undefined;
  }
}

/** Entradas da mesma origem em dois meses ou mais, com valor parecido e alto: salário. */
function recurringIncome(txs: Tx[]) {
  const groups = new Map<string, { months: Set<string>; amounts: number[] }>();
  for (const t of txs) {
    if (t.kind !== 'entrada' || t.category === 'transferencia' || t.category === 'rendimento') continue;
    const key = ruleKey(t.description);
    if (!key) continue;
    const g = groups.get(key) ?? { months: new Set(), amounts: [] };
    g.months.add(t.date.slice(0, 7));
    g.amounts.push(t.amount);
    groups.set(key, g);
  }
  const keys = new Set<string>();
  for (const [key, g] of groups) {
    if (g.months.size < 2) continue;
    const mean = g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length;
    const sd = Math.sqrt(g.amounts.reduce((n, x) => n + (x - mean) ** 2, 0) / g.amounts.length);
    if (mean >= 1000 && sd / mean <= 0.15) keys.add(key);
  }
  return keys;
}

/** Vencimento a pagar com valor e data parecidos. */
function matchBill(bills: Bill[], t: Tx) {
  const key = ruleKey(t.description);
  return bills.find((b) => {
    if (b.paid) return false;
    const close = Math.abs(t.amount - b.amount) <= Math.max(1, b.amount * 0.1);
    const inTime = near(t.date, b.dueDate, 10);
    // mesmo nome, ou a mesma conta de consumo ("Conta de luz" e "Enel" são luz)
    const family = groupKey(t.description, t.category)?.key;
    const sameName =
      (key !== null && (ruleKey(b.title) === key || normalize(t.description).includes(normalize(b.title)))) ||
      (!!family && family.startsWith('f:') && family === groupKey(b.title, b.category)?.key);
    return close && inTime && (sameName || (b.category === t.category && Math.abs(t.amount - b.amount) < 0.011));
  });
}
