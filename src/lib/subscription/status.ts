import { MESES } from '@/lib/dates';
import {
  ENTITLEMENT,
  NO_SUBSCRIPTION,
  type Entitlement,
  type Period,
  type PeriodUnit,
  type Plan,
  type SubStore,
} from './types';

/** O pedaço do CustomerInfo do RevenueCat que o Baiu usa. */
export type EntitlementLike = {
  isActive: boolean;
  willRenew: boolean;
  periodType: string;
  expirationDate: string | null;
  store: string;
  productIdentifier: string;
  billingIssueDetectedAt: string | null;
};
export type CustomerInfoLike = {
  entitlements: { active: Record<string, EntitlementLike>; all: Record<string, EntitlementLike> };
  managementURL?: string | null;
};

const STORES: Record<string, SubStore> = { APP_STORE: 'app_store', PLAY_STORE: 'play_store', TEST_STORE: 'teste' };

export function entitlementFrom(info: CustomerInfoLike): Entitlement {
  const e = info.entitlements.active[ENTITLEMENT] ?? info.entitlements.all[ENTITLEMENT];
  if (!e) return NO_SUBSCRIPTION;
  const base = {
    trial: e.periodType === 'TRIAL',
    until: e.expirationDate,
    willRenew: e.willRenew,
    store: STORES[e.store] ?? 'outra',
    productId: e.productIdentifier || null,
    manageUrl: info.managementURL ?? null,
  };
  if (!e.isActive) return { ...base, status: 'expirada', active: false, willRenew: false };
  const status = e.billingIssueDetectedAt ? 'pagamento' : !e.willRenew ? 'cancelada' : base.trial ? 'teste' : 'ativa';
  return { ...base, status, active: true };
}

const UNITS: Record<string, PeriodUnit> = { DAY: 'dia', WEEK: 'semana', MONTH: 'mes', YEAR: 'ano' };

/** Teste grátis do produto, no formato da App Store (introPrice) ou do Google Play (freePhase). */
export function trialOf(product: {
  introPrice?: { price: number; periodUnit: string; periodNumberOfUnits: number; cycles: number } | null;
  defaultOption?: {
    freePhase?: { billingPeriod: { unit: string; value: number }; billingCycleCount?: number | null } | null;
  } | null;
}): Period | null {
  const ios = product.introPrice;
  if (ios && ios.price === 0 && UNITS[ios.periodUnit]) {
    return { unit: UNITS[ios.periodUnit], count: Math.max(1, ios.periodNumberOfUnits * Math.max(1, ios.cycles)) };
  }
  const free = product.defaultOption?.freePhase;
  if (free && UNITS[free.billingPeriod.unit]) {
    const cycles = Math.max(1, free.billingCycleCount ?? 1);
    return { unit: UNITS[free.billingPeriod.unit], count: Math.max(1, free.billingPeriod.value * cycles) };
  }
  return null;
}

const UNIT_NAMES: Record<PeriodUnit, [string, string]> = {
  dia: ['dia', 'dias'],
  semana: ['semana', 'semanas'],
  mes: ['mês', 'meses'],
  ano: ['ano', 'anos'],
};

/** "1 mês", "7 dias". */
export function periodLabel(p: Period) {
  return `${p.count} ${UNIT_NAMES[p.unit][p.count === 1 ? 0 : 1]}`;
}

/** "mês grátis", "7 dias grátis". */
export function trialName(p: Period) {
  return p.count === 1 && p.unit === 'mes' ? 'mês grátis' : `${periodLabel(p)} grátis`;
}

/** "R$ 14,90 por mês". */
export function priceLabel(plan: Plan) {
  return `${plan.price} por ${plan.period === 'ano' ? 'ano' : 'mês'}`;
}

/** "14 de novembro" (com o ano, se não for o atual). */
export function dateLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const year = d.getFullYear() !== now.getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}${year}`;
}

export const STORE_NAMES: Record<SubStore, string> = {
  app_store: 'App Store',
  play_store: 'Google Play',
  teste: 'loja de teste',
  outra: 'loja',
};

/** Título e explicação do estado da assinatura, para a tela e para os Ajustes. */
export function describe(
  ent: Entitlement,
  plan: Plan | null = null,
  now = new Date(),
): { title: string; detail: string } {
  const until = ent.until ? dateLabel(ent.until, now) : null;
  const store = ent.store ? STORE_NAMES[ent.store] : 'loja';
  const price = plan ? priceLabel(plan) : null;
  switch (ent.status) {
    case 'teste':
      return {
        title: until ? `Mês grátis até ${until}` : 'Mês grátis',
        detail: `Depois, ${price ? `são ${price}` : 'a assinatura começa a ser cobrada'}, pela ${store}. Se não quiser continuar, cancele antes${until ? ` de ${until}` : ''}.`,
      };
    case 'ativa':
      return {
        title: 'Assinatura ativa',
        detail: until ? `Renova em ${until}${price ? `, por ${price}` : ''}.` : 'Renova sozinha até você cancelar.',
      };
    case 'cancelada':
      return {
        title: 'Assinatura cancelada',
        detail: until
          ? `Você usa o Baiu até ${until}. Depois disso, não há cobrança.`
          : 'Você usa o Baiu até o fim do período. Depois disso, não há cobrança.',
      };
    case 'pagamento':
      return {
        title: 'Problema no pagamento',
        detail: `A ${store} não conseguiu cobrar. Atualize a forma de pagamento para não perder o acesso.`,
      };
    case 'expirada':
      return { title: 'Assinatura encerrada', detail: 'Seus registros continuam guardados neste aparelho.' };
    default:
      return { title: 'Sem assinatura', detail: 'O primeiro mês é grátis.' };
  }
}

/** Quando lembrar que o mês grátis vai acabar: dois dias antes (ou um, se não der mais). */
export function trialReminderAt(ent: Entitlement, now = new Date()): Date | null {
  if (ent.status !== 'teste' || !ent.until) return null;
  const end = Date.parse(ent.until);
  for (const days of [2, 1]) {
    const at = end - days * 86_400_000;
    if (at > now.getTime() + 60_000) return new Date(at);
  }
  return null;
}

/** Dias até o mês grátis virar cobrança; null para quem não está nele ou já cancelou. */
export function trialDaysLeft(ent: Entitlement, now = new Date()): number | null {
  if (ent.status !== 'teste' || !ent.until) return null;
  return Math.max(0, Math.ceil((Date.parse(ent.until) - now.getTime()) / 86_400_000));
}

/** Mensal primeiro: é o plano com o mês grátis em destaque. */
export function sortPlans(plans: Plan[]) {
  return [...plans].sort((a, b) => (a.period === b.period ? a.amount - b.amount : a.period === 'mes' ? -1 : 1));
}
