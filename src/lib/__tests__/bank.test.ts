/* eslint-disable @typescript-eslint/no-require-imports -- o mock do AsyncStorage vem por require */
import { createEmpty } from '@/data/demo';
import type { Bill, State, Tx } from '@/data/types';
import { reducer } from '@/store/reducer';
import { categorize, ruleKey, tidyDescription } from '../bank/categorize';
import { BankFailure, createFakeBank } from '../bank/client';
import { fakeBankData } from '../bank/fake-data';
import { bankIdFor, mergeBankSync } from '../bank/merge';
import type { RemoteTx, SyncPayload } from '../bank/types';
import { computeFolego } from '../folego';
import { accountTotal } from '../ledger';
import { migrate } from '../migrate';
import { flowsIn } from '../summary';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1 }));

const NOW = new Date(2026, 9, 15, 12);
const debit = (description: string, p: Partial<RemoteTx> = {}) => ({ description, type: 'DEBIT' as const, ...p });
const credit = (description: string, p: Partial<RemoteTx> = {}) => ({ description, type: 'CREDIT' as const, ...p });
const cat = (t: ReturnType<typeof debit>, acc: 'BANK' | 'CREDIT' = 'BANK', rules = {}) => categorize(t, acc, rules);

const start = (): State => reducer(createEmpty(NOW), { type: 'onboard' });
const sync = (s: State, p: SyncPayload, at = NOW) => reducer(s, { type: 'bankSync', payload: p, at: at.toISOString() });

describe('categoria automática', () => {
  it.each([
    ['IFOOD *RESTAURANTE', 'alimentacao'],
    ['UBER *TRIP', 'transporte'],
    ['UBER EATS', 'alimentacao'],
    ['SUPERMERCADO DIA', 'mercado'],
    ['MERCADO EXTRA', 'mercado'],
    ['MERCADOLIVRE*VENDEDOR', 'compras'],
    ['MERCADO LIVRE', 'compras'],
    ['NETFLIX.COM', 'assinaturas'],
    ['APPLE.COM/BILL', 'assinaturas'],
    ['SABESP CONTA', 'contas'],
    ['DROGASIL 1234', 'saude'],
    ['SMART FIT', 'saude'],
    ['POSTO IPIRANGA', 'transporte'],
    ['PETZ', 'pets'],
    ['LATAM AIRLINES', 'viagem'],
    ['CINEMARK', 'lazer'],
    ['ALUGUEL IMOBILIARIA', 'casa'],
  ])('%s -> %s', (d, expected) => {
    const g = cat(debit(d));
    expect(g.category).toBe(expected);
    expect(g.review).toBe(false);
  });

  it('usa a categoria do provedor quando houver', () => {
    expect(cat(debit('ESTABELECIMENTO 123', { category: 'Groceries' }))).toMatchObject({
      category: 'mercado',
      by: 'banco',
    });
    expect(cat(debit('X', { category: 'Electricity' })).category).toBe('contas');
    expect(cat(debit('X', { category: 'Pet supplies and vet' })).category).toBe('pets');
  });

  it('entende as categorias da Polp', () => {
    expect(cat(debit('ESTABELECIMENTO 123', { category: 'FOOD_AND_DRINK_GROCERIES' }))).toMatchObject({
      category: 'mercado',
      by: 'banco',
    });
    expect(cat(debit('X', { category: 'FOOD_AND_DRINK_RESTAURANT' })).category).toBe('alimentacao');
    expect(cat(debit('X', { category: 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY' })).category).toBe('contas');
    expect(cat(debit('X', { category: 'RENT_AND_UTILITIES_RENT' })).category).toBe('casa');
    expect(cat(debit('X', { category: 'MEDICAL_VETERINARY_SERVICES' })).category).toBe('pets');
    expect(cat(debit('X', { category: 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES' })).category).toBe('transporte');
    expect(cat(credit('ACME', { category: 'INCOME_SALARY' })).category).toBe('salario');
    expect(cat(credit('X', { category: 'INCOME_DIVIDENDS' })).category).toBe('rendimento');
    expect(cat(debit('PAG FAT', { category: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' })).internal).toBe('fatura');
    expect(cat(debit('PIX', { category: 'TRANSFER_OUT_ACCOUNT_TRANSFER' })).internal).toBe('mesma-pessoa');
    expect(cat(debit('APLIC', { category: 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS' })).internal).toBe('aplicacao');
    expect(cat(debit('X', { category: 'OTHER_OTHER' }))).toMatchObject({ category: 'outros', review: true });
  });

  it('streaming da Polp é assinatura, mas o nome da loja decide antes (cinema é lazer)', () => {
    expect(cat(debit('NETFLIX.COM', { category: 'ENTERTAINMENT_TV_AND_MOVIES' })).category).toBe('assinaturas');
    expect(cat(debit('SERVICO X', { category: 'ENTERTAINMENT_TV_AND_MOVIES' })).category).toBe('assinaturas');
    expect(cat(debit('CINEMARK SHOPPING', { category: 'ENTERTAINMENT_TV_AND_MOVIES' })).category).toBe('lazer');
  });

  it('reconhece salário pelo provedor, pela operação ou pelo texto', () => {
    expect(cat(credit('ACME', { category: 'Salary' })).category).toBe('salario');
    expect(cat(credit('CREDITO', { operationType: 'FOLHA_PAGAMENTO' })).category).toBe('salario');
    expect(cat(credit('PAGTO SALARIO ACME LTDA')).category).toBe('salario');
  });

  it('rendimento e estorno', () => {
    expect(cat(credit('X', { operationType: 'RENDIMENTO_APLIC_FINANCEIRA' })).category).toBe('rendimento');
    expect(cat(credit('ESTORNO COMPRA')).category).toBe('reembolso');
    expect(cat(credit('QUALQUER'), 'CREDIT').category).toBe('reembolso');
  });

  it('Pix de alguém fica para a pessoa conferir', () => {
    expect(cat(credit('PIX RECEBIDO JOAO', { party: 'cpf' }))).toMatchObject({
      category: 'outras_entradas',
      review: true,
    });
    expect(cat(credit('PIX RECEBIDO ACME LTDA', { party: 'cnpj' }))).toMatchObject({
      category: 'renda_extra',
      review: true,
    });
    expect(cat(debit('PIX ENVIADO MARIA', { category: 'Transfer - PIX', party: 'cpf' }))).toMatchObject({
      category: 'outros',
      review: true,
    });
  });

  it('dinheiro que só muda de lugar', () => {
    expect(cat(debit('PAGAMENTO DE FATURA')).internal).toBe('fatura');
    expect(cat(credit('PAGAMENTO RECEBIDO', { operationType: 'PAGAMENTO_FATURA' }), 'CREDIT').internal).toBe('fatura');
    expect(cat(debit('PIX', { category: 'Same person transfer - PIX' })).internal).toBe('mesma-pessoa');
    expect(cat(debit('APLICACAO CDB')).internal).toBe('aplicacao');
    expect(cat(credit('RESGATE CDB')).internal).toBe('resgate');
    expect(cat(debit('APLICACAO CDB')).category).toBe('transferencia');
  });

  it('o que a pessoa ensinou vem primeiro', () => {
    const rules = { 'comercial xyz': 'lazer' as const };
    expect(cat(debit('COMERCIAL XYZ LTDA'), 'BANK', rules)).toMatchObject({
      category: 'lazer',
      by: 'aprendida',
      review: false,
    });
    // regra de saída não vale para entrada
    expect(cat(credit('COMERCIAL XYZ LTDA'), 'BANK', rules).category).not.toBe('lazer');
  });

  it('chave das regras e descrições legíveis', () => {
    expect(ruleKey('PIX ENVIADO MARIA OLIVEIRA')).toBe('maria oliveira');
    expect(ruleKey('IFOOD *RESTAURANTE 123')).toBe('ifood restaurante');
    expect(tidyDescription('SUPERMERCADO   DIA DE SAO PAULO')).toBe('Supermercado Dia de Sao Paulo');
    expect(tidyDescription('iFood')).toBe('iFood');
    expect(tidyDescription('IFOOD *RESTAURANTE')).toBe('Ifood *Restaurante');
  });

  it('nome da instituição vira o banco do app', () => {
    expect(bankIdFor('Nubank')).toBe('nubank');
    expect(bankIdFor('Itaú Unibanco')).toBe('itau');
    expect(bankIdFor('Banco Inter')).toBe('inter');
    expect(bankIdFor('Banco do Brasil')).toBe('bb');
    expect(bankIdFor('Cooperativa X')).toBe('outro');
  });
});

describe('primeira busca de um banco', () => {
  const payload = fakeBankData('item1', 'Nubank', NOW);
  const { state: s, summary } = mergeBankSync(start(), payload, NOW);
  const cc = s.accounts.find((a) => a.link?.remote === 'item1:cc')!;
  const card = s.accounts.find((a) => a.link?.remote === 'item1:card')!;
  const inv = s.accounts.find((a) => a.kind === 'investimento')!;

  it('banco fora da lista do app aparece com o nome da instituição', () => {
    const other = mergeBankSync(start(), fakeBankData('x', 'Cooperativa Vale', NOW), NOW).state;
    expect(other.accounts.find((a) => a.kind === 'corrente')).toMatchObject({
      bankId: 'outro',
      nickname: 'Cooperativa Vale',
    });
    expect(other.accounts.find((a) => a.kind === 'investimento')?.nickname).toBe('Cooperativa Vale');
  });

  it('cria conta corrente, cartão e carteira com o saldo do banco', () => {
    expect(cc).toMatchObject({ kind: 'corrente', bankId: 'nubank', balance: payload.accounts[0].balance });
    expect(card).toMatchObject({
      kind: 'cartao',
      balance: 1480.35,
      limit: 8000,
      dueDay: 10,
      nickname: 'Cartão Exemplo Gold',
    });
    expect(card.link?.last4).toBe('9876');
    expect(s.holdings.filter((h) => h.accountId === inv.id).map((h) => h.kind)).toEqual(['CDB', 'Tesouro']);
    expect(accountTotal(inv, s.holdings)).toBeCloseTo(
      payload.investments.reduce((n, i) => n + i.balance, 0),
      2,
    );
    expect(summary.accounts).toBe(3);
  });

  it('importa os movimentos categorizados', () => {
    const by = (d: string) => s.txs.find((t) => t.description.startsWith(d))!;
    expect(by('Pagto Salario')).toMatchObject({ kind: 'entrada', category: 'salario' });
    expect(by('Ifood')).toMatchObject({ kind: 'saida', category: 'alimentacao', method: 'cartao' });
    expect(by('Supermercado Dia')).toMatchObject({ category: 'mercado' });
    expect(by('Netflix')).toMatchObject({ category: 'assinaturas' });
    expect(by('Enel')).toMatchObject({ category: 'contas', method: 'boleto' });
    expect(by('Tarifa')).toMatchObject({ category: 'contas' });
    expect(by('Rendimento')).toMatchObject({ kind: 'entrada', category: 'rendimento' });
    expect(by('Pix Enviado Maria')).toMatchObject({ category: 'outros', review: true });
    expect(by('Comercial Xyz')).toMatchObject({ category: 'outros', review: true });
    expect(summary.added).toBe(s.txs.length);
    expect(summary.review).toBeGreaterThan(0);
  });

  it('fatura paga vira uma transferência só, da conta para o cartão', () => {
    const faturas = s.txs.filter((t) => /Fatura|Pagamento Recebido/.test(t.description));
    expect(faturas.length).toBe(4);
    for (const f of faturas) expect(f).toMatchObject({ kind: 'transferencia', accountId: cc.id, toAccountId: card.id });
  });

  it('aplicação no CDB vira aporte para a carteira', () => {
    const ap = s.txs.filter((t) => t.description.startsWith('Aplicacao'));
    expect(ap.length).toBe(4);
    for (const a of ap) expect(a).toMatchObject({ kind: 'transferencia', accountId: cc.id, toAccountId: inv.id });
    expect(flowsIn(s, { start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) }).aportes).toBe(500);
  });

  it('nada do banco mexe no saldo: o saldo é o que o banco informa', () => {
    expect(s.accounts.find((a) => a.id === cc.id)!.balance).toBe(payload.accounts[0].balance);
  });

  it('o fôlego passa a ser medido com os dados do banco', () => {
    const f = computeFolego(s, NOW);
    expect(f.summary.entradas).toBeGreaterThan(5000);
    expect(f.summary.gastos).toBeGreaterThan(1000);
    expect(f.summary.aportes).toBeGreaterThan(0);
  });

  it('buscar de novo não duplica nada', () => {
    const again = sync(s, payload);
    expect(again.txs.length).toBe(s.txs.length);
    expect(again.accounts.length).toBe(s.accounts.length);
    expect(again.holdings.length).toBe(s.holdings.length);
  });

  it('com o passar dos dias, entram só os movimentos novos', () => {
    const later = new Date(2026, 9, 25, 12);
    const next = sync(s, fakeBankData('item1', 'Nubank', later), later);
    const added = next.txs.length - s.txs.length;
    expect(added).toBeGreaterThan(3);
    expect(new Set(next.txs.map((t) => t.ext?.id)).size).toBe(next.txs.length);
  });

  it('valor dos investimentos atualizado vira rendimento do mês', () => {
    const p2 = { ...payload, investments: payload.investments.map((i) => ({ ...i, balance: i.balance + 10 })) };
    const next = sync(s, p2);
    const cdb = next.holdings.find((h) => h.ext?.id === 'item1:cdb')!;
    expect(cdb.yields.at(-1)?.amount).toBe(10);
  });
});

describe('correções e aprendizado', () => {
  const base = mergeBankSync(start(), fakeBankData('item1', 'Banco Exemplo', NOW), NOW).state;
  const loja = base.txs.filter((t) => t.description.startsWith('Comercial Xyz'));

  it('corrigir uma categoria corrige os parecidos e aprende para os próximos', () => {
    const s = reducer(base, { type: 'recategorize', id: loja[0].id, category: 'lazer' });
    const after = s.txs.filter((t) => t.description.startsWith('Comercial Xyz'));
    expect(after[0]).toMatchObject({ category: 'lazer', catBy: 'pessoa', review: undefined });
    expect(after.slice(1).every((t) => t.category === 'lazer' && t.catBy === 'aprendida' && !t.review)).toBe(true);
    expect(s.bank.rules['comercial xyz']).toBe('lazer');
    // próximo mês, já chega certo
    const later = new Date(2026, 10, 25, 12);
    const next = sync(s, fakeBankData('item1', 'Banco Exemplo', later), later);
    const fresh = next.txs.filter(
      (t) => t.description.startsWith('Comercial Xyz') && !s.txs.some((o) => o.id === t.id),
    );
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((t) => t.category === 'lazer' && !t.review)).toBe(true);
  });

  it('não aceita categoria de entrada numa saída', () => {
    expect(reducer(base, { type: 'recategorize', id: loja[0].id, category: 'salario' })).toBe(base);
  });

  it('confirmar tira da lista de conferir', () => {
    const ids = base.txs.filter((t) => t.review).map((t) => t.id);
    const s = reducer(base, { type: 'confirmTxs', ids });
    expect(s.txs.some((t) => t.review)).toBe(false);
  });

  it('apagar um movimento do banco: some e não volta', () => {
    const s = reducer(base, { type: 'removeTx', id: loja[0].id });
    expect(s.txs.some((t) => t.id === loja[0].id)).toBe(false);
    const again = sync(s, fakeBankData('item1', 'Banco Exemplo', NOW));
    expect(again.txs.some((t) => t.ext?.id === loja[0].ext!.id)).toBe(false);
    // e o saldo continua o do banco
    expect(again.accounts.find((a) => a.link?.remote === 'item1:cc')!.balance).toBe(
      base.accounts.find((a) => a.link?.remote === 'item1:cc')!.balance,
    );
  });

  it('movimento do banco só troca o nome; valor e data são do banco', () => {
    const t = loja[0];
    const s = reducer(base, {
      type: 'updateTx',
      tx: { ...t, description: 'Presente da Ana', amount: 1, date: NOW.toISOString() },
    });
    expect(s.txs.find((x) => x.id === t.id)).toMatchObject({
      description: 'Presente da Ana',
      amount: t.amount,
      date: t.date,
    });
  });

  it('saldo de conta conectada não é editável', () => {
    const cc = base.accounts.find((a) => a.link)!;
    const s = reducer(base, { type: 'updateAccount', id: cc.id, patch: { balance: 1, nickname: 'Principal' } });
    expect(s.accounts.find((a) => a.id === cc.id)).toMatchObject({ balance: cc.balance, nickname: 'Principal' });
  });

  it('remover uma conta conectada: ela não volta na próxima busca', () => {
    const card = base.accounts.find((a) => a.kind === 'cartao')!;
    const s = reducer(base, { type: 'removeAccount', id: card.id });
    const again = sync(s, fakeBankData('item1', 'Banco Exemplo', NOW));
    expect(again.accounts.some((a) => a.link?.remote === card.link!.remote)).toBe(false);
  });
});

describe('desconectar', () => {
  const base = reducer(sync(start(), fakeBankData('item1', 'Banco Exemplo', NOW)), {
    type: 'addAccount',
    account: { id: 'manual', bankId: 'caixa', kind: 'reserva', balance: 900, createdAt: NOW.toISOString() },
  });

  it('apagando os dados: contas, movimentos e investimentos do banco saem; o resto fica', () => {
    const s = reducer(base, { type: 'bankUnlink', itemId: 'item1', keep: false });
    expect(s.accounts.map((a) => a.id)).toEqual(['manual']);
    expect(s.txs).toHaveLength(0);
    expect(s.holdings).toHaveLength(0);
    expect(s.bank.items).toHaveLength(0);
  });

  it('mantendo os dados: tudo fica, mas vira manual', () => {
    const s = reducer(base, { type: 'bankUnlink', itemId: 'item1', keep: true });
    expect(s.accounts.length).toBe(base.accounts.length);
    expect(s.accounts.every((a) => !a.link)).toBe(true);
    expect(s.txs.every((t) => !t.ext)).toBe(true);
    expect(s.bank.items).toHaveLength(0);
  });
});

describe('casos especiais', () => {
  const acct = (id: string, type: 'BANK' | 'CREDIT', item = 'i1') => ({
    id,
    itemId: item,
    type,
    subtype: type === 'CREDIT' ? 'CREDIT_CARD' : 'CHECKING_ACCOUNT',
    name: id,
    balance: 100,
  });
  const rt = (
    id: string,
    accountId: string,
    date: string,
    description: string,
    amount: number,
    type: 'CREDIT' | 'DEBIT',
    p: Partial<RemoteTx> = {},
  ): RemoteTx => ({
    id,
    accountId,
    date,
    description,
    amount,
    type,
    ...p,
  });
  const items = [
    { id: 'i1', name: 'Nubank', status: 'UPDATED' },
    { id: 'i2', name: 'Itaú', status: 'UPDATED' },
  ];

  it('Pix para mim mesmo entre dois bancos conectados vira uma transferência', () => {
    const p: SyncPayload = {
      items,
      accounts: [acct('a', 'BANK', 'i1'), acct('b', 'BANK', 'i2')],
      transactions: [
        rt('t1', 'a', '2026-10-10T10:00:00Z', 'PIX ENVIADO', -300, 'DEBIT', { category: 'Same person transfer - PIX' }),
        rt('t2', 'b', '2026-10-11T09:00:00Z', 'PIX RECEBIDO', 300, 'CREDIT', {
          category: 'Same person transfer - PIX',
        }),
      ],
      investments: [],
    };
    const s = sync(start(), p);
    expect(s.txs).toHaveLength(1);
    expect(s.txs[0]).toMatchObject({ kind: 'transferencia', amount: 300 });
    expect(flowsIn(s, { start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) })).toMatchObject({
      entradas: 0,
      gastos: 0,
    });
  });

  it('a outra ponta que chega numa busca seguinte também é juntada', () => {
    const first: SyncPayload = {
      items: [items[0]],
      accounts: [acct('a', 'BANK', 'i1')],
      transactions: [
        rt('t1', 'a', '2026-10-10T10:00:00Z', 'PIX ENVIADO', -300, 'DEBIT', { category: 'Same person transfer - PIX' }),
      ],
      investments: [],
    };
    let s = sync(start(), first);
    expect(s.txs[0]).toMatchObject({ kind: 'saida', category: 'transferencia' });
    s = sync(s, {
      items: [items[1]],
      accounts: [acct('b', 'BANK', 'i2')],
      transactions: [
        rt('t2', 'b', '2026-10-11T09:00:00Z', 'PIX RECEBIDO', 300, 'CREDIT', {
          category: 'Same person transfer - PIX',
        }),
      ],
      investments: [],
    });
    expect(s.txs).toHaveLength(1);
    expect(s.txs[0].kind).toBe('transferencia');
  });

  it('fatura de um cartão que não está no Baiu conta como gasto, para conferir', () => {
    const s = sync(start(), {
      items: [items[0]],
      accounts: [acct('a', 'BANK')],
      transactions: [rt('t1', 'a', '2026-10-10T10:00:00Z', 'PAGAMENTO DE FATURA', -900, 'DEBIT')],
      investments: [],
    });
    expect(s.txs[0]).toMatchObject({ kind: 'saida', category: 'outros', review: true });
  });

  it('salário sem nome de salário é reconhecido por se repetir todo mês', () => {
    const tx = (id: string, m: number, v: number) =>
      rt(id, 'a', new Date(2026, m, 5, 9).toISOString(), 'PIX RECEBIDO ACME LTDA', v, 'CREDIT', { party: 'cnpj' });
    const s = sync(start(), {
      items: [items[0]],
      accounts: [acct('a', 'BANK')],
      transactions: [tx('s1', 7, 4800), tx('s2', 8, 4800), tx('s3', 9, 4850)],
      investments: [],
    });
    expect(s.txs.every((t) => t.category === 'salario' && !t.review)).toBe(true);
  });

  it('pagamento de vencimento cadastrado é marcado como pago sozinho', () => {
    const bill: Bill = {
      id: 'b1',
      title: 'Conta de luz Enel',
      amount: 150,
      dueDate: new Date(2026, 9, 12, 12).toISOString(),
      category: 'contas',
      repeatMonthly: true,
      paid: false,
      createdAt: NOW.toISOString(),
    };
    const s0 = reducer(start(), { type: 'addBill', bill });
    const s = sync(s0, {
      items: [items[0]],
      accounts: [acct('a', 'BANK')],
      transactions: [
        rt('t1', 'a', '2026-10-10T10:00:00Z', 'ENEL DISTRIBUICAO', -152.4, 'DEBIT', { category: 'Electricity' }),
      ],
      investments: [],
    });
    const paid = s.bills.find((b) => b.id === 'b1')!;
    const tx = s.txs[0] as Tx;
    expect(paid).toMatchObject({ paid: true, paidTxId: tx.id });
    expect(tx.billId).toBe('b1');
    expect(s.bills.filter((b) => !b.paid)).toHaveLength(1);
  });

  it('movimento de conta desconhecida ou valor zero é ignorado', () => {
    const s = sync(start(), {
      items: [items[0]],
      accounts: [acct('a', 'BANK')],
      transactions: [
        rt('t1', 'zzz', '2026-10-10T10:00:00Z', 'X', -10, 'DEBIT'),
        rt('t2', 'a', '2026-10-10T10:00:00Z', 'Y', 0, 'DEBIT'),
      ],
      investments: [],
    });
    expect(s.txs).toHaveLength(0);
  });

  it('dados antigos ganham a parte de bancos vazia', () => {
    const old = { ...createEmpty(NOW) } as Partial<State>;
    delete old.bank;
    expect(migrate(old)!.bank).toEqual({ items: [], ignored: {}, hiddenAccounts: {}, rules: {} });
  });
});

describe('banco de teste', () => {
  it('autoriza, busca e cancela, guardando o histórico', async () => {
    const b = createFakeBank({ now: () => NOW });
    const banks = await b.institutions();
    expect(banks.map((x) => x.name)).toContain('Banco Exemplo');
    const c = await b.start('exemplo', '529.982.247-25');
    expect(c).toMatchObject({ name: 'Banco Exemplo', status: 'AUTHORISED', url: null });
    await expect(b.status(c.id)).resolves.toMatchObject({ consent: 'AUTHORISED', item: { id: c.id } });
    const p = await b.sync({});
    expect(p.accounts).toHaveLength(2);
    expect(p.transactions.every((t) => new Date(t.date) <= NOW)).toBe(true);
    await b.unlink(c.id);
    const after = await b.sync({ [c.id]: NOW.toISOString() });
    expect(after.items).toHaveLength(0);
    expect(after.revoked).toEqual([c.id]);
    const [h] = await b.history();
    expect(h).toMatchObject({ id: c.id, status: 'cancelada', products: ['ACCOUNT', 'CREDIT_CARD_ACCOUNT', 'INVESTMENTS'] });
    expect(h.revokedAt).toBe(NOW.toISOString());
  });

  it('CPF inválido e banco fora do ar', async () => {
    const b = createFakeBank();
    await expect(b.start('exemplo', '111.111.111-11')).rejects.toEqual(new BankFailure('cpf'));
    await expect(b.start('parado', '529.982.247-25')).rejects.toEqual(new BankFailure('bank_down'));
  });

  it('sem internet', async () => {
    const b = createFakeBank({ offline: () => true });
    await expect(b.sync({})).rejects.toEqual(new BankFailure('network'));
  });

  it('conexão que não existe', async () => {
    await expect(createFakeBank().status('nada')).rejects.toEqual(new BankFailure('not_found'));
  });
});
