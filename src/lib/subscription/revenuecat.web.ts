import type { SubscriptionBackend } from './backend';

// Na web não há App Store nem Google Play: as assinaturas ficam desligadas.
export const createRevenueCat: ((apiKey: string, forget: () => Promise<void>) => SubscriptionBackend) | null = null;
