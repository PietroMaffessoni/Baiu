import type { Account, Tx } from '@/data/types';
import { accountTotal, applyTx, isAporte, signedAmount, validateTx } from '../ledger';

const acc = (id: string, kind: Account['kind'], balance: number): Account => ({
  id,
  bankId: 'nubank',
  kind,
  balance,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const tx = (p: Partial<Tx>): Tx => ({
  id: 't',
  kind: 'saida',
  accountId: 'c',
  amount: 10,
  description: 'x',
  category: 'mercado',
  date: '2026-10-10T12:00:00.000Z',
  createdAt: '2026-10-10T12:00:00.000Z',
  ...p,
});

const accounts = [
  acc('c', 'corrente', 1000),
  acc('r', 'reserva', 500),
  acc('k', 'cartao', 200),
  acc('i', 'investimento', 0),
];
const byId = new Map(accounts.map((a) => [a.id, a]));
const bal = (list: Account[], id: string) => list.find((a) => a.id === id)!.balance;

describe('applyTx', () => {
  it('saída reduz a conta corrente', () => {
    expect(bal(applyTx(accounts, tx({ amount: 99.9 })), 'c')).toBe(900.1);
  });

  it('compra no cartão aumenta a fatura', () => {
    expect(bal(applyTx(accounts, tx({ accountId: 'k', amount: 50 })), 'k')).toBe(250);
  });

  it('entrada soma na conta e estorno reduz a fatura', () => {
    expect(bal(applyTx(accounts, tx({ kind: 'entrada', amount: 300 })), 'c')).toBe(1300);
    expect(bal(applyTx(accounts, tx({ kind: 'entrada', accountId: 'k', amount: 20 })), 'k')).toBe(180);
  });

  it('pagar a fatura tira da conta e zera a dívida', () => {
    const next = applyTx(accounts, tx({ kind: 'transferencia', toAccountId: 'k', amount: 200 }));
    expect(bal(next, 'c')).toBe(800);
    expect(bal(next, 'k')).toBe(0);
  });

  it('desfazer volta exatamente ao saldo anterior', () => {
    const t = tx({ kind: 'transferencia', toAccountId: 'r', amount: 123.45 });
    const back = applyTx(applyTx(accounts, t, 1), t, -1);
    expect(back.map((a) => a.balance)).toEqual(accounts.map((a) => a.balance));
  });

  it('não acumula erro de ponto flutuante', () => {
    let list = accounts;
    for (let i = 0; i < 10; i++) list = applyTx(list, tx({ amount: 0.1 }));
    expect(bal(list, 'c')).toBe(999);
  });
});

describe('visão de cada movimento', () => {
  it('transferência é neutra na visão geral e tem sinal na visão da conta', () => {
    const t = tx({ kind: 'transferencia', toAccountId: 'r', amount: 40 });
    expect(signedAmount(t)).toBe(0);
    expect(signedAmount(t, 'c')).toBe(-40);
    expect(signedAmount(t, 'r')).toBe(40);
  });

  it('aporte é transferência para investimento vinda de fora', () => {
    expect(isAporte(tx({ kind: 'transferencia', toAccountId: 'i' }), byId)).toBe(true);
    expect(isAporte(tx({ kind: 'transferencia', toAccountId: 'r' }), byId)).toBe(false);
  });

  it('conta de investimento soma saldo parado e ativos', () => {
    const holdings = [
      {
        id: 'h',
        accountId: 'i',
        name: 'CDB',
        kind: 'CDB' as const,
        value: 1000,
        invested: 900,
        yields: [],
        createdAt: '',
      },
    ];
    expect(accountTotal({ ...accounts[3], balance: 50 }, holdings)).toBe(1050);
  });
});

describe('validateTx', () => {
  it('recusa valor zero, conta inexistente e transferência inválida', () => {
    expect(validateTx(tx({ amount: 0 }), byId)).toMatch(/valor/);
    expect(validateTx(tx({ accountId: 'zz' }), byId)).toMatch(/conta/);
    expect(validateTx(tx({ kind: 'transferencia', toAccountId: 'c' }), byId)).toMatch(/diferentes/);
    expect(validateTx(tx({ kind: 'transferencia', accountId: 'k', toAccountId: 'c' }), byId)).toMatch(/cartão/);
    expect(validateTx(tx({}), byId)).toBeNull();
  });
});
