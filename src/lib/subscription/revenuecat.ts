import { Linking, Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { SubFailure, type SubErrorCode, type SubscriptionBackend } from './backend';
import { entitlementFrom, sortPlans, trialOf } from './status';
import { NO_SUBSCRIPTION, type Entitlement, type Plan } from './types';

const ANDROID_PACKAGE = 'com.pitroibas.baiu';

const map = (info: CustomerInfo): Entitlement => entitlementFrom(info);

function failure(e: unknown): SubFailure {
  if (e instanceof SubFailure) return e;
  const err = e as { code?: string; userCancelled?: boolean | null } | null;
  const C = Purchases.PURCHASES_ERROR_CODE;
  const codes: Partial<Record<string, SubErrorCode>> = {
    [C.PURCHASE_CANCELLED_ERROR]: 'cancelled',
    [C.PAYMENT_PENDING_ERROR]: 'pending',
    [C.NETWORK_ERROR]: 'network',
    [C.OFFLINE_CONNECTION_ERROR]: 'network',
    [C.PURCHASE_NOT_ALLOWED_ERROR]: 'not_allowed',
    [C.RECEIPT_ALREADY_IN_USE_ERROR]: 'in_use',
    [C.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR]: 'unavailable',
    [C.STORE_PROBLEM_ERROR]: 'store',
  };
  if (err?.userCancelled) return new SubFailure('cancelled');
  return new SubFailure((err?.code && codes[err.code]) || 'unknown');
}

/**
 * Assinaturas pela App Store e pelo Google Play, com o RevenueCat conferindo
 * os recibos. O RevenueCat só conhece o id da conta (um código aleatório):
 * nada de nome, e-mail ou celular. Os dados de pagamento ficam com as lojas.
 */
export function createRevenueCat(apiKey: string, forget: () => Promise<void>): SubscriptionBackend {
  let configured = false;
  let packages = new Map<string, PurchasesPackage>();
  const listeners = new Set<(e: Entitlement) => void>();

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      throw failure(e);
    }
  };

  return {
    enabled: true,
    fake: false,
    identify: (userId) =>
      run(async () => {
        if (!configured) {
          Purchases.configure({
            apiKey,
            appUserID: userId,
            diagnosticsEnabled: false,
            automaticDeviceIdentifierCollectionEnabled: false,
          });
          Purchases.addCustomerInfoUpdateListener((info) => {
            const e = map(info);
            listeners.forEach((l) => l(e));
          });
          configured = true;
        } else if ((await Purchases.getAppUserID()) !== userId) {
          return map((await Purchases.logIn(userId)).customerInfo);
        }
        return map(await Purchases.getCustomerInfo());
      }),
    refresh: (force) =>
      run(async () => {
        if (!configured) return NO_SUBSCRIPTION;
        if (force) await Purchases.invalidateCustomerInfoCache();
        return map(await Purchases.getCustomerInfo());
      }),
    plans: () =>
      run(async () => {
        const offerings = await Purchases.getOfferings();
        const T = Purchases.PACKAGE_TYPE;
        const pkgs = (offerings.current?.availablePackages ?? []).filter(
          (p) => p.packageType === T.MONTHLY || p.packageType === T.ANNUAL,
        );
        packages = new Map(pkgs.map((p) => [p.identifier, p]));
        // na App Store, o mês grátis só aparece quando a loja confirma que a pessoa tem direito
        let eligible: Record<string, boolean> | null = null;
        if (Platform.OS === 'ios') {
          const res = await Purchases.checkTrialOrIntroductoryPriceEligibility(
            pkgs.map((p) => p.product.identifier),
          ).catch(() => ({}) as Record<string, { status: number }>);
          eligible = {};
          for (const p of pkgs) {
            eligible[p.product.identifier] =
              res[p.product.identifier]?.status ===
              Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
          }
        }
        return sortPlans(
          pkgs.map((p): Plan => {
            const annual = p.packageType === T.ANNUAL;
            return {
              id: p.identifier,
              productId: p.product.identifier,
              period: annual ? 'ano' : 'mes',
              price: p.product.priceString,
              amount: p.product.price,
              perMonth: annual ? p.product.pricePerMonthString : null,
              trial: !eligible || eligible[p.product.identifier] ? trialOf(p.product) : null,
            };
          }),
        );
      }),
    purchase: (planId) =>
      run(async () => {
        const pkg = packages.get(planId);
        if (!pkg) throw new SubFailure('unavailable');
        return map((await Purchases.purchasePackage(pkg)).customerInfo);
      }),
    restore: () => run(async () => map(await Purchases.restorePurchases())),
    manage: async (ent) => {
      if (Platform.OS === 'ios' && ent.store !== 'play_store') {
        try {
          await Purchases.showManageSubscriptions();
          return;
        } catch {}
      }
      const sku = ent.productId?.split(':')[0];
      const url =
        ent.manageUrl ??
        (ent.store === 'app_store' || (Platform.OS === 'ios' && ent.store !== 'play_store')
          ? 'https://apps.apple.com/account/subscriptions'
          : `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}${sku ? `&sku=${sku}` : ''}`);
      await Linking.openURL(url);
    },
    signOut: async () => {
      if (!configured) return;
      try {
        await Purchases.logOut();
      } catch {}
    },
    onChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    forget,
  };
}
