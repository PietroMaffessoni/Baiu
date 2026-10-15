import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { Button } from '@/components/button';
import { CategoryGrid } from '@/components/form';
import { Icon } from '@/components/icon';
import { Plate, Rule } from '@/components/layout';
import { Money } from '@/components/money';
import { bankById } from '@/data/banks';
import { CATEGORY, IN_CATEGORIES, OUT_CATEGORIES } from '@/data/categories';
import type { Tx } from '@/data/types';
import { shortDate } from '@/lib/dates';
import { useAccountsById, useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

/**
 * "Confira": movimentos do banco em que o Baiu não teve certeza da
 * categoria. Um toque confirma; escolher outra categoria ensina o Baiu,
 * e os próximos parecidos já chegam certos.
 */
export default function Revisar() {
  const { state, dispatch } = useStore();
  const folego = useFolego();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(
    () => state.txs.filter((t) => t.review).sort((a, b) => b.date.localeCompare(a.date)),
    [state.txs],
  );

  if (list.length === 0) {
    return (
      <View style={[styles.screen, styles.done]}>
        <Baiu score={folego.score} width={140} />
        <T variant="title2" align="center">
          Tudo conferido
        </T>
        <T variant="callout" tone="ink2" align="center">
          Quando o Baiu ficar em dúvida sobre um movimento novo, ele aparece aqui.
        </T>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: gutter, paddingBottom: insets.bottom + 40, gap: 14 }}>
      <T variant="callout" tone="ink2">
        O Baiu não teve certeza destes {list.length === 1 ? 'movimento' : `${list.length} movimentos`}. Toque para
        trocar a categoria; ele aprende e os próximos parecidos já chegam certos.
      </T>
      <Button
        label={list.length === 1 ? 'Está certo' : 'Está tudo certo'}
        kind="secondary"
        icon="check"
        onPress={() => dispatch({ type: 'confirmTxs', ids: list.map((t) => t.id) })}
      />
      <Plate style={{ paddingHorizontal: 14 }}>
        {list.map((t, i) => (
          <View key={t.id}>
            {i > 0 ? <Rule /> : null}
            <Row tx={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
          </View>
        ))}
      </Plate>
    </ScrollView>
  );
}

function Row({ tx, open, onToggle }: { tx: Tx; open: boolean; onToggle: () => void }) {
  const { dispatch } = useStore();
  const byId = useAccountsById();
  const acc = byId.get(tx.accountId);
  const cat = CATEGORY[tx.category];
  return (
    <View style={{ paddingVertical: 12, gap: 10 }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${tx.description}, ${cat.label}. Trocar categoria`}
        style={styles.row}>
        <View style={{ flex: 1 }}>
          <T variant="calloutStrong" numberOfLines={1}>
            {tx.description}
          </T>
          <T variant="caption" tone="ink3">
            {shortDate(tx.date)} · {acc ? (acc.nickname ?? bankById(acc.bankId).name) : ''}
          </T>
          <View style={styles.chip}>
            <Icon name={cat.icon} size={13} tint={color.lantern} />
            <T variant="captionStrong" tone="lantern">
              {cat.label}
            </T>
          </View>
        </View>
        <Money value={tx.kind === 'saida' ? -tx.amount : tx.amount} variant="calloutStrong" />
      </Pressable>
      {open ? (
        <>
          <CategoryGrid
            categories={tx.kind === 'entrada' ? IN_CATEGORIES : OUT_CATEGORIES}
            value={tx.category}
            onChange={(c) => dispatch({ type: 'recategorize', id: tx.id, category: c })}
          />
          <Button
            label="Está certo assim"
            kind="quiet"
            onPress={() => dispatch({ type: 'confirmTxs', ids: [tx.id] })}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  done: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: gutter },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: color.lanternWash,
  },
});
