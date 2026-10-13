import { createDemo, createEmpty } from '@/data/demo';
import type { Account, Bill, State, Tx } from '@/data/types';
import { computeFolego } from '@/lib/folego';
import { migrate } from '@/lib/migrate';
import { sealsFor } from '@/lib/seals';
import { reducer } from '../reducer';

const NOW = new Date();
const iso = (daysAgo = 0) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

const account = (id: string, kind: Account['kind'], balance = 0): Account => ({
  id,
  bankId: 'nubank',
  kind,
  balance,
  createdAt: iso(1),
});

const start = (): State => {
  let s = reducer(createEmpty(), { type: 'onboard' });
  s = reducer(s, { type: 'addAccount', account: account('c', 'corrente', 1000) });
  s = reducer(s, { type: 'addAccount', account: account('r', 'reserva', 0) });
  s = reducer(s, { type: 'addAccount', account: account('k', 'cartao', 0) });
  s = reducer(s, { type: 'addAccount', account: account('i', 'investimento', 0) });
  return s;
};

const tx = (p: Partial<Tx>): Tx => ({
  id: `t${Math.random()}`,
  kind: 'saida',
  accountId: 'c',
  amount: 10,
  description: 'x',
  category: 'mercado',
  date: iso(),
  createdAt: iso(),
  ...p,
});

const bal = (s: State, id: string) => s.accounts.find((a) => a.id === id)!.balance;

describe('contas e movimentos', () => {
  it('usuário novo começa vazio, com o Baiu meio cheio', () => {
    const s = reducer(createEmpty(), { type: 'onboard' });
    const f = computeFolego(s);
    expect(s.accounts).toHaveLength(0);
    expect(f.score).toBe(25);
    expect(f.mood.mood).toBe('meio');
    expect(f.habit.text).toMatch(/Cadastre/);
  });

  it('primeira conta carimba o selo', () => {
    expect(start().seals['primeira-conta']).toBeDefined();
  });

  it('editar um movimento troca o efeito no saldo', () => {
    let s = start();
    const t = tx({ id: 'a', amount: 100 });
    s = reducer(s, { type: 'addTx', tx: t });
    expect(bal(s, 'c')).toBe(900);
    s = reducer(s, { type: 'updateTx', tx: { ...t, accountId: 'k', amount: 40 } });
    expect(bal(s, 'c')).toBe(1000);
    expect(bal(s, 'k')).toBe(40);
    s = reducer(s, { type: 'removeTx', id: 'a' });
    expect(bal(s, 'k')).toBe(0);
    expect(s.txs).toHaveLength(0);
  });

  it('movimento inválido não muda nada', () => {
    const s = start();
    expect(reducer(s, { type: 'addTx', tx: tx({ amount: -5 }) })).toBe(s);
    expect(reducer(s, { type: 'addTx', tx: tx({ kind: 'transferencia', toAccountId: 'c' }) })).toBe(s);
  });

  it('remover conta apaga seus movimentos', () => {
    let s = start();
    s = reducer(s, { type: 'addTx', tx: tx({ kind: 'transferencia', toAccountId: 'r', amount: 300 }) });
    s = reducer(s, { type: 'removeAccount', id: 'r' });
    expect(s.txs).toHaveLength(0);
    expect(s.accounts.find((a) => a.id === 'r')).toBeUndefined();
  });
});

describe('fôlego', () => {
  it('sobe com entrada, reserva e aporte', () => {
    let s = start();
    s = reducer(s, { type: 'addTx', tx: tx({ kind: 'entrada', amount: 5000, category: 'salario' }) });
    s = reducer(s, { type: 'addTx', tx: tx({ amount: 2000 }) });
    const before = computeFolego(s).score;
    s = reducer(s, { type: 'addTx', tx: tx({ kind: 'transferencia', toAccountId: 'r', amount: 2000 }) });
    s = reducer(s, { type: 'addTx', tx: tx({ kind: 'transferencia', toAccountId: 'i', amount: 750 }) });
    const after = computeFolego(s);
    expect(after.score).toBeGreaterThan(before);
    expect(after.pillars.find((p) => p.key === 'constancia')!.points).toBe(25);
  });

  it('reserva sem gastos registrados não vale pontos', () => {
    let s = start();
    s = reducer(s, { type: 'updateAccount', id: 'r', patch: { balance: 50000 } });
    expect(computeFolego(s).pillars.find((p) => p.key === 'reserva')!.points).toBe(0);
  });

  it('dados de exemplo deixam o Baiu cheio, com um próximo passo em reais', () => {
    const demo = { ...createDemo(), onboarded: true };
    const f = computeFolego(demo);
    expect(f.mood.mood).toBe('cheio');
    expect(f.habit.text).toMatch(/R\$/);
  });
});

describe('vencimentos', () => {
  const bill = (p: Partial<Bill>): Bill => ({
    id: 'b',
    title: 'Internet',
    amount: 100,
    dueDate: iso(-5),
    category: 'contas',
    repeatMonthly: true,
    paid: false,
    createdAt: iso(10),
    ...p,
  });

  it('pagar cria o movimento, marca como pago e agenda o próximo mês', () => {
    let s = reducer(start(), { type: 'addBill', bill: bill({}) });
    s = reducer(s, { type: 'payBill', id: 'b', accountId: 'c', date: iso() });
    expect(bal(s, 'c')).toBe(900);
    expect(s.bills.find((b) => b.id === 'b')!.paid).toBe(true);
    const next = s.bills.find((b) => b.fromBillId === 'b')!;
    expect(next.paid).toBe(false);
    expect(new Date(next.dueDate).getMonth()).toBe((new Date(iso(-5)).getMonth() + 1) % 12);
  });

  it('apagar o pagamento devolve o vencimento e tira a recorrência', () => {
    let s = reducer(start(), { type: 'addBill', bill: bill({}) });
    s = reducer(s, { type: 'payBill', id: 'b', accountId: 'c', date: iso() });
    const paidTx = s.txs[0];
    s = reducer(s, { type: 'removeTx', id: paidTx.id });
    expect(bal(s, 'c')).toBe(1000);
    expect(s.bills).toHaveLength(1);
    expect(s.bills[0].paid).toBe(false);
  });

  it('vencimento atrasado derruba metade do pilar', () => {
    const s = reducer(start(), { type: 'addBill', bill: bill({ dueDate: iso(3), repeatMonthly: false }) });
    expect(computeFolego(s).pillars.find((p) => p.key === 'emdia')!.points).toBe(12.5);
  });
});

describe('investimentos', () => {
  const holding = {
    id: 'h',
    accountId: 'i',
    name: 'CDB',
    kind: 'CDB' as const,
    value: 1000,
    invested: 1000,
    yields: [],
    createdAt: iso(),
  };

  it('aplicar a partir de uma conta vira aporte e não deixa sobra na corretora', () => {
    let s = reducer(start(), { type: 'addHolding', holding, origin: { type: 'conta', accountId: 'c' } });
    expect(bal(s, 'c')).toBe(0);
    expect(bal(s, 'i')).toBe(0);
    expect(s.holdings[0].value).toBe(1000);
    expect(s.txs[0].kind).toBe('transferencia');
    s = reducer(s, { type: 'holdingValue', id: 'h', value: 1012.5, date: iso() });
    expect(s.holdings[0].yields.at(-1)!.amount).toBe(12.5);
  });

  it('não aplica mais do que o saldo parado', () => {
    const s = start();
    expect(reducer(s, { type: 'addHolding', holding, origin: { type: 'saldo' } })).toBe(s);
  });

  it('resgate devolve dinheiro e reduz o custo na proporção', () => {
    let s = reducer(start(), {
      type: 'addHolding',
      holding: { ...holding, value: 1200 },
      origin: { type: 'existente' },
    });
    s = reducer(s, { type: 'holdingRedeem', id: 'h', amount: 600, toAccountId: 'c', date: iso() });
    expect(s.holdings[0].value).toBe(600);
    expect(s.holdings[0].invested).toBe(500);
    expect(bal(s, 'c')).toBe(1600);
    expect(bal(s, 'i')).toBe(0);
  });
});

describe('persistência', () => {
  it('migra estados válidos e recusa formatos desconhecidos', () => {
    const demo = createDemo();
    const back = migrate(JSON.parse(JSON.stringify(demo)));
    expect(back?.txs).toHaveLength(demo.txs.length);
    expect(migrate({ version: 1 })).toBeNull();
    expect(migrate('lixo')).toBeNull();
  });

  it('selos carimbados mantêm a data', () => {
    const demo = createDemo();
    const seals = sealsFor(demo);
    expect(seals.find((x) => x.id === 'primeira-conta')!.earned).toBe(true);
    expect(seals.find((x) => x.id === 'reserva-6')!.earned).toBe(false);
  });
});
