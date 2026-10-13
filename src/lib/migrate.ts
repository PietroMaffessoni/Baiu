import { DEFAULT_SETTINGS } from '@/data/demo';
import type { State } from '@/data/types';

/**
 * Normaliza o que veio do disco. Campos novos ganham valor padrão; formatos
 * desconhecidos são recusados em vez de quebrar o app.
 */
export function migrate(raw: unknown): State | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<State>;
  if (s.version !== 2) return null;
  if (!Array.isArray(s.accounts) || !Array.isArray(s.txs)) return null;
  return {
    version: 2,
    onboarded: !!s.onboarded,
    demo: !!s.demo,
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) },
    accounts: s.accounts,
    txs: s.txs,
    bills: Array.isArray(s.bills) ? s.bills : [],
    holdings: Array.isArray(s.holdings)
      ? s.holdings.map((h) => ({ ...h, yields: Array.isArray(h.yields) ? h.yields : [] }))
      : [],
    seals: s.seals && typeof s.seals === 'object' ? s.seals : {},
    createdAt: s.createdAt ?? new Date().toISOString(),
  };
}
