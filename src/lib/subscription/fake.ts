import { SubFailure, type SubscriptionBackend } from './backend';
import { entitlementFrom, type CustomerInfoLike } from './status';
import { ENTITLEMENT, NO_SUBSCRIPTION, type Entitlement, type Plan } from './types';

/** Assinatura de uma conta na loja de teste. */
export type FakeSub = {
  plan: 'mensal' | 'anual';
  /** Fim do período atual (ISO). */
  until: string;
  trial: boolean;
  willRenew: boolean;
  /** A loja não conseguiu cobrar. */
  billingIssue?: boolean;
};
type FakeDb = {
  subs: Record<string, FakeSub>;
  trialUsed: Record<string, true>;
  /** Planos à venda; sem isto, mensal e anual. Serve para testar a loja só com o mensal. */
  offered?: FakeSub['plan'][];
};

export const FAKE_STORE_KEY = 'baiu:fake-store';

const PLANS = {
  mensal: {
    id: '$rc_monthly',
    productId: 'baiu_mensal',
    period: 'mes',
    price: 'R$ 24,90',
    amount: 24.9,
    perMonth: null,
  },
  anual: {
    id: '$rc_annual',
    productId: 'baiu_anual',
    period: 'ano',
    price: 'R$ 249,90',
    amount: 249.9,
    perMonth: 'R$ 20,83',
  },
} as const;

const addPeriod = (d: Date, plan: FakeSub['plan']) => {
  const n = new Date(d);
  if (plan === 'anual') n.setFullYear(n.getFullYear() + 1);
  else n.setMonth(n.getMonth() + 1);
  return n;
};

/**
 * Loja de mentira para testes automatizados e para a web de desenvolvimento
 * (EXPO_PUBLIC_AUTH_FAKE=1). Imita o que App Store e Google Play fazem:
 * primeiro mês grátis uma vez por pessoa, renovação sozinha, cancelamento
 * que vale no fim do período.
 */
export function createFakeStore(opts: { latencyMs?: number; now?: () => Date; offline?: () => boolean } = {}) {
  let memory: FakeDb = { subs: {}, trialUsed: {} };
  const browser = typeof localStorage !== 'undefined';
  const load = (): FakeDb => {
    if (!browser) return memory;
    try {
      return { subs: {}, trialUsed: {}, ...JSON.parse(localStorage.getItem(FAKE_STORE_KEY) ?? '{}') };
    } catch {
      return { subs: {}, trialUsed: {} };
    }
  };
  const save = (d: FakeDb) => (browser ? localStorage.setItem(FAKE_STORE_KEY, JSON.stringify(d)) : void (memory = d));
  const now = () => opts.now?.() ?? new Date();
  const wait = async () => {
    if (opts.offline?.()) throw new SubFailure('network');
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
  };

  let user: string | null = null;
  const listeners = new Set<(e: Entitlement) => void>();

  /** A loja renova sozinha quem não cancelou. */
  const current = (): Entitlement => {
    if (!user) return NO_SUBSCRIPTION;
    const d = load();
    const s = d.subs[user];
    if (!s) return NO_SUBSCRIPTION;
    if (s.willRenew && !s.billingIssue) {
      let until = new Date(s.until);
      let renewed = false;
      while (until <= now()) {
        until = addPeriod(until, s.plan);
        renewed = true;
      }
      if (renewed) {
        d.subs[user] = { ...s, until: until.toISOString(), trial: false };
        save(d);
      }
    }
    const sub = d.subs[user];
    const active = new Date(sub.until) > now();
    const info = {
      isActive: active,
      willRenew: sub.willRenew,
      periodType: sub.trial ? 'TRIAL' : 'NORMAL',
      expirationDate: sub.until,
      store: 'TEST_STORE',
      productIdentifier: PLANS[sub.plan].productId,
      billingIssueDetectedAt: sub.billingIssue ? now().toISOString() : null,
    };
    const customer: CustomerInfoLike = {
      entitlements: { active: active ? { [ENTITLEMENT]: info } : {}, all: { [ENTITLEMENT]: info } },
      managementURL: null,
    };
    return entitlementFrom(customer);
  };
  const emit = () => {
    const e = current();
    listeners.forEach((l) => l(e));
    return e;
  };
  const me = () => {
    if (!user) throw new SubFailure('unknown');
    return user;
  };

  const backend: SubscriptionBackend & { _db: () => FakeDb; _set: (uid: string, sub: FakeSub | null) => void } = {
    enabled: true,
    fake: true,
    _db: load,
    _set: (uid, sub) => {
      const d = load();
      if (sub) d.subs[uid] = sub;
      else delete d.subs[uid];
      save(d);
    },
    async identify(userId) {
      user = userId;
      await wait();
      return current();
    },
    async refresh() {
      await wait();
      return current();
    },
    async plans() {
      await wait();
      const d = load();
      const used = !!(user && d.trialUsed[user]);
      return (d.offered ?? (['mensal', 'anual'] as const)).map((k): Plan => ({
        ...PLANS[k],
        trial: used ? null : { unit: 'mes', count: 1 },
      }));
    },
    async purchase(planId) {
      const uid = me();
      await wait();
      const plan = planId === PLANS.anual.id ? 'anual' : planId === PLANS.mensal.id ? 'mensal' : null;
      if (!plan) throw new SubFailure('unavailable');
      const d = load();
      // já assinante: a loja só confirma a assinatura que existe
      if (current().active) return emit();
      const trial = !d.trialUsed[uid];
      const until = trial ? addPeriod(now(), 'mensal') : addPeriod(now(), plan);
      d.subs[uid] = { plan, until: until.toISOString(), trial, willRenew: true };
      d.trialUsed[uid] = true;
      save(d);
      return emit();
    },
    async restore() {
      await wait();
      return emit();
    },
    /** Na loja de teste, "gerenciar" é cancelar ou reativar a renovação, como a pessoa faria na loja. */
    async manage() {
      const uid = me();
      await wait();
      const d = load();
      const s = d.subs[uid];
      if (!s) return;
      d.subs[uid] = s.billingIssue ? { ...s, billingIssue: false } : { ...s, willRenew: !s.willRenew };
      save(d);
      emit();
    },
    async signOut() {
      user = null;
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async forget() {
      const uid = me();
      await wait();
      const d = load();
      delete d.subs[uid];
      save(d);
    },
  };
  return backend;
}
