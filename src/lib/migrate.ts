import { createAssistant, createBank, DEFAULT_SETTINGS } from '@/data/demo';
import type { Assistant, Bank, BankItem, ChatMsg, State } from '@/data/types';
import { DEFAULT_LOOK, isBaiuColor } from './look';

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
    baiu: {
      color: isBaiuColor(s.baiu?.color) ? s.baiu.color : DEFAULT_LOOK.color,
      seasonal: typeof s.baiu?.seasonal === 'boolean' ? s.baiu.seasonal : DEFAULT_LOOK.seasonal,
    },
    assistant: migrateAssistant(s.assistant),
    bank: migrateBank(s.bank),
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

const isRecord = (v: unknown): v is Record<string, string> => !!v && typeof v === 'object' && !Array.isArray(v);

function migrateAssistant(raw: Partial<Assistant> | undefined): Assistant {
  const base = createAssistant();
  if (!raw || typeof raw !== 'object') return base;
  const consent =
    raw.consent && typeof raw.consent.version === 'string' && typeof raw.consent.at === 'string' ? raw.consent : null;
  const chat = Array.isArray(raw.chat)
    ? raw.chat.filter(
        (m): m is ChatMsg =>
          !!m && typeof m.id === 'string' && typeof m.text === 'string' && (m.role === 'user' || m.role === 'baiu'),
      )
    : [];
  return {
    consent,
    declined: !!raw.declined,
    pendingRevoke: !!raw.pendingRevoke,
    shareNumbers: typeof raw.shareNumbers === 'boolean' ? raw.shareNumbers : base.shareNumbers,
    greeted: !!raw.greeted,
    chat,
    seen: isRecord(raw.seen) ? raw.seen : {},
    notified: isRecord(raw.notified) ? raw.notified : {},
  };
}

const isFlags = (v: unknown): v is Record<string, true> => !!v && typeof v === 'object' && !Array.isArray(v);

function migrateBank(raw: Partial<Bank> | undefined): Bank {
  const base = createBank();
  if (!raw || typeof raw !== 'object') return base;
  const items = Array.isArray(raw.items)
    ? raw.items.filter(
        (i): i is BankItem => !!i && typeof i.id === 'string' && typeof i.name === 'string' && typeof i.connectedAt === 'string',
      )
    : [];
  return {
    items,
    ignored: isFlags(raw.ignored) ? raw.ignored : {},
    hiddenAccounts: isFlags(raw.hiddenAccounts) ? raw.hiddenAccounts : {},
    rules: isRecord(raw.rules) ? (raw.rules as Bank['rules']) : {},
  };
}
