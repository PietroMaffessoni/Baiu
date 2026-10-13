import { Pressable, StyleSheet, View } from 'react-native';

import { bankById } from '@/data/banks';
import { CATEGORY, METHOD_LABEL } from '@/data/categories';
import type { Account, Tx } from '@/data/types';
import { signedAmount } from '@/lib/ledger';
import { T } from '@/theme/text';
import { color } from '@/theme/tokens';
import { Icon } from './icon';
import { Money } from './money';

const nameOf = (a?: Account) => (a ? (a.nickname ?? bankById(a.bankId).name) : 'Conta removida');

type Props = {
  tx: Tx;
  accounts: Map<string, Account>;
  /** Conta de referência: muda o sinal das transferências. */
  perspective?: string;
  showAccount?: boolean;
  onPress?: () => void;
};

export function TxRow({ tx, accounts, perspective, showAccount = true, onPress }: Props) {
  const cat = CATEGORY[tx.category];
  const transfer = tx.kind === 'transferencia';
  const signed = signedAmount(tx, perspective);
  const income = signed > 0 && !transfer;

  let meta: string;
  if (transfer) {
    const from = nameOf(accounts.get(tx.accountId));
    const to = nameOf(accounts.get(tx.toAccountId ?? ''));
    meta =
      perspective === tx.accountId
        ? `Para ${to}`
        : perspective === tx.toAccountId
          ? `De ${from}`
          : `De ${from} para ${to}`;
  } else {
    meta = [
      cat.label,
      tx.method ? METHOD_LABEL[tx.method] : null,
      showAccount ? nameOf(accounts.get(tx.accountId)) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  const body = (
    <View style={styles.row}>
      <View style={[styles.glyph, income && styles.glyphIn]}>
        <Icon name={cat.icon} size={17} tint={income ? color.jade : color.ink2} />
      </View>
      <View style={styles.text}>
        <T variant="calloutStrong" numberOfLines={1}>
          {tx.description || cat.label}
        </T>
        <T variant="caption" tone="ink3" numberOfLines={1}>
          {meta}
        </T>
      </View>
      {signed === 0 ? (
        <Money value={tx.amount} variant="calloutStrong" tone="ink2" sign="never" align="right" />
      ) : (
        <Money value={signed} variant="calloutStrong" sign="always" colorize={!transfer} align="right" />
      )}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
      accessibilityRole="button"
      accessibilityHint="Abre os detalhes do movimento">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 60 },
  glyph: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  glyphIn: { backgroundColor: 'rgba(94, 214, 167, 0.1)', borderColor: 'rgba(94, 214, 167, 0.28)' },
  text: { flex: 1, gap: 1 },
});
