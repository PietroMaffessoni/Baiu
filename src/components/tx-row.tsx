import { StyleSheet, View } from 'react-native';

import { bankById } from '@/data/banks';
import { CATEGORY, METHOD_LABEL } from '@/data/categories';
import type { Account, Tx } from '@/data/types';
import { T } from '@/theme/text';
import { color } from '@/theme/tokens';
import { Icon } from './icon';
import { Money } from './money';

export function TxRow({ tx, account, showAccount = true }: { tx: Tx; account?: Account; showAccount?: boolean }) {
  const cat = CATEGORY[tx.category];
  const income = tx.amount > 0;
  const accName = account ? (account.nickname ?? bankById(account.bankId).name) : '';
  const meta = [cat.label, METHOD_LABEL[tx.method], showAccount ? accName : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <View style={[styles.glyph, income && styles.glyphIn]}>
        <Icon name={cat.icon} size={17} tint={income ? color.jade : color.ink2} />
      </View>
      <View style={styles.text}>
        <T variant="calloutStrong" numberOfLines={1}>
          {tx.description}
        </T>
        <T variant="caption" tone="ink3" numberOfLines={1}>
          {meta}
        </T>
      </View>
      <Money value={tx.amount} variant="calloutStrong" sign="always" colorize align="right" />
    </View>
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
