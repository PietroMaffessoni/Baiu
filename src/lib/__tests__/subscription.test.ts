import { SubFailure } from '../subscription/backend';
import { createFakeStore } from '../subscription/fake';
import {
  dateLabel,
  describe as describeSub,
  entitlementFrom,
  periodLabel,
  priceLabel,
  sortPlans,
  trialName,
  trialOf,
  trialReminderAt,
  type EntitlementLike,
} from '../subscription/status';
import { NO_SUBSCRIPTION, type Entitlement, type Plan } from '../subscription/types';

const NOW = new Date('2026-10-15T12:00:00Z');
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

const ent = (over: Partial<EntitlementLike> = {}): EntitlementLike => ({
  isActive: true,
  willRenew: true,
  periodType: 'NORMAL',
  expirationDate: at(20),
  store: 'APP_STORE',
  productIdentifier: 'baiu_mensal',
  billingIssueDetectedAt: null,
  ...over,
});
const info = (e: EntitlementLike | null, key = 'assinatura') => ({
  entitlements: { active: e?.isActive ? { [key]: e } : {}, all: e ? { [key]: e } : {} },
  managementURL: 'https://apps.apple.com/account/subscriptions',
});

const monthly: Plan = {
  id: '$rc_monthly',
  productId: 'baiu_mensal',
  period: 'mes',
  price: 'R$ 14,90',
  amount: 14.9,
  perMonth: null,
  trial: { unit: 'mes', count: 1 },
};
const annual: Plan = {
  ...monthly,
  id: '$rc_annual',
  productId: 'baiu_anual',
  period: 'ano',
  price: 'R$ 149,90',
  amount: 149.9,
};

describe('estado da assinatura a partir do RevenueCat', () => {
  test('mês grátis', () => {
    const e = entitlementFrom(info(ent({ periodType: 'TRIAL' })));
    expect(e).toMatchObject({ status: 'teste', active: true, trial: true, store: 'app_store', until: at(20) });
    expect(e.manageUrl).toContain('apps.apple.com');
  });
  test('pagando', () => expect(entitlementFrom(info(ent())).status).toBe('ativa'));
  test('cancelou: usa até o fim e não renova', () => {
    expect(entitlementFrom(info(ent({ willRenew: false, periodType: 'TRIAL' })))).toMatchObject({
      status: 'cancelada',
      active: true,
      trial: true,
    });
  });
  test('problema no pagamento, ainda no prazo', () => {
    const e = entitlementFrom(info(ent({ billingIssueDetectedAt: at(-2), store: 'PLAY_STORE' })));
    expect(e).toMatchObject({ status: 'pagamento', active: true, store: 'play_store' });
  });
  test('vencida', () => {
    expect(entitlementFrom(info(ent({ isActive: false, expirationDate: at(-3) })))).toMatchObject({
      status: 'expirada',
      active: false,
      willRenew: false,
    });
  });
  test('nunca assinou, ou outro direito de uso', () => {
    expect(entitlementFrom(info(null))).toEqual(NO_SUBSCRIPTION);
    expect(entitlementFrom(info(ent(), 'outro'))).toEqual(NO_SUBSCRIPTION);
  });
});

describe('teste grátis do produto', () => {
  test('App Store: preço de entrada zero', () => {
    expect(trialOf({ introPrice: { price: 0, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 1 } })).toEqual({
      unit: 'mes',
      count: 1,
    });
    expect(trialOf({ introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 2 } })).toEqual({
      unit: 'semana',
      count: 2,
    });
  });
  test('App Store: desconto pago não é grátis', () => {
    expect(trialOf({ introPrice: { price: 4.9, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 1 } })).toBeNull();
  });
  test('Google Play: fase grátis da oferta', () => {
    expect(
      trialOf({ defaultOption: { freePhase: { billingPeriod: { unit: 'MONTH', value: 1 }, billingCycleCount: 1 } } }),
    ).toEqual({
      unit: 'mes',
      count: 1,
    });
    expect(trialOf({ defaultOption: { freePhase: null } })).toBeNull();
    expect(trialOf({})).toBeNull();
  });
  test('textos', () => {
    expect(trialName({ unit: 'mes', count: 1 })).toBe('mês grátis');
    expect(trialName({ unit: 'dia', count: 7 })).toBe('7 dias grátis');
    expect(periodLabel({ unit: 'mes', count: 2 })).toBe('2 meses');
    expect(priceLabel(monthly)).toBe('R$ 14,90 por mês');
    expect(priceLabel(annual)).toBe('R$ 149,90 por ano');
  });
  test('mensal primeiro', () => expect(sortPlans([annual, monthly]).map((p) => p.period)).toEqual(['mes', 'ano']));
});

describe('o que a pessoa lê', () => {
  const e = (over: Partial<Entitlement>): Entitlement => ({
    ...NO_SUBSCRIPTION,
    active: true,
    store: 'app_store',
    until: '2026-11-14T12:00:00Z',
    ...over,
  });
  test('data por extenso', () => {
    expect(dateLabel('2026-11-14T12:00:00Z', NOW)).toBe('14 de novembro');
    expect(dateLabel('2027-01-14T12:00:00Z', NOW)).toBe('14 de janeiro de 2027');
  });
  test('mês grátis diz quando cobra, quanto e quem', () => {
    const d = describeSub(e({ status: 'teste', trial: true, willRenew: true }), monthly, NOW);
    expect(d.title).toBe('Mês grátis até 14 de novembro');
    expect(d.detail).toContain('R$ 14,90 por mês');
    expect(d.detail).toContain('App Store');
    expect(d.detail).toContain('cancele antes de 14 de novembro');
  });
  test('cancelada diz até quando usa e que não cobra mais', () => {
    expect(describeSub(e({ status: 'cancelada' }), null, NOW).detail).toBe(
      'Você usa o Baiu até 14 de novembro. Depois disso, não há cobrança.',
    );
  });
  test('ativa diz quando renova', () => {
    expect(describeSub(e({ status: 'ativa', willRenew: true }), monthly, NOW).detail).toBe(
      'Renova em 14 de novembro, por R$ 14,90 por mês.',
    );
  });
  test('problema no pagamento pede para atualizar', () => {
    expect(describeSub(e({ status: 'pagamento', store: 'play_store' }), null, NOW).detail).toContain('Google Play');
  });
});

describe('aviso antes da primeira cobrança', () => {
  const trial = (days: number): Entitlement => ({
    ...NO_SUBSCRIPTION,
    status: 'teste',
    active: true,
    trial: true,
    willRenew: true,
    until: at(days),
  });
  test('dois dias antes do fim do mês grátis', () => {
    expect(trialReminderAt(trial(30), NOW)?.toISOString()).toBe(at(28));
  });
  test('perto do fim, um dia antes', () => {
    expect(trialReminderAt(trial(1.5), NOW)?.toISOString()).toBe(at(0.5));
  });
  test('tarde demais, ou já cancelou, ou já paga: sem aviso', () => {
    expect(trialReminderAt(trial(0.5), NOW)).toBeNull();
    expect(trialReminderAt({ ...trial(30), status: 'cancelada', willRenew: false }, NOW)).toBeNull();
    expect(trialReminderAt({ ...trial(30), status: 'ativa', trial: false }, NOW)).toBeNull();
  });
});

describe('loja de teste', () => {
  const setup = () => {
    let now = NOW;
    const store = createFakeStore({ now: () => now });
    return { store, travel: (days: number) => (now = new Date(now.getTime() + days * DAY)) };
  };

  test('primeiro mês grátis, depois renova sozinha e cobra', async () => {
    const { store, travel } = setup();
    expect(await store.identify('ana')).toEqual(NO_SUBSCRIPTION);
    const plans = await store.plans();
    expect(plans[0]).toMatchObject({ period: 'mes', trial: { unit: 'mes', count: 1 } });
    const e = await store.purchase(plans[0].id);
    expect(e).toMatchObject({ status: 'teste', active: true, trial: true, store: 'teste' });
    expect(e.until?.slice(0, 10)).toBe('2026-11-15');
    travel(31);
    const renewed = await store.refresh();
    expect(renewed).toMatchObject({ status: 'ativa', active: true, trial: false });
    expect(renewed.until?.slice(0, 10)).toBe('2026-12-15');
  });

  test('cancelar vale no fim do período; depois disso, sem acesso', async () => {
    const { store, travel } = setup();
    await store.identify('ana');
    await store.purchase('$rc_monthly');
    await store.manage(NO_SUBSCRIPTION);
    expect(await store.refresh()).toMatchObject({ status: 'cancelada', active: true });
    travel(31);
    expect(await store.refresh()).toMatchObject({ status: 'expirada', active: false });
  });

  test('o mês grátis é um só por pessoa', async () => {
    const { store, travel } = setup();
    await store.identify('ana');
    await store.purchase('$rc_monthly');
    await store.manage(NO_SUBSCRIPTION);
    travel(40);
    const plans = await store.plans();
    expect(plans.every((p) => p.trial === null)).toBe(true);
    expect(await store.purchase('$rc_monthly')).toMatchObject({ status: 'ativa', trial: false });
  });

  test('outra pessoa no mesmo aparelho tem a própria assinatura', async () => {
    const { store } = setup();
    await store.identify('ana');
    await store.purchase('$rc_monthly');
    expect(await store.identify('bruno')).toEqual(NO_SUBSCRIPTION);
    expect((await store.plans())[0].trial).not.toBeNull();
  });

  test('avisa quem está ouvindo', async () => {
    const { store } = setup();
    const seen: string[] = [];
    store.onChange((e) => seen.push(e.status));
    await store.identify('ana');
    await store.purchase('$rc_monthly');
    expect(seen).toEqual(['teste']);
  });

  test('esquecer apaga o cadastro', async () => {
    const { store } = setup();
    await store.identify('ana');
    await store.purchase('$rc_monthly');
    await store.forget();
    expect(store._db().subs.ana).toBeUndefined();
  });

  test('plano que não existe e compra sem conta', async () => {
    const { store } = setup();
    await expect(store.purchase('$rc_monthly')).rejects.toBeInstanceOf(SubFailure);
    await store.identify('ana');
    await expect(store.purchase('vitalicio')).rejects.toMatchObject({ code: 'unavailable' });
  });
});
