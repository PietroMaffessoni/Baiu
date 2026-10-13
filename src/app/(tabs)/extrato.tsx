import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DayBars } from '@/components/day-bars';
import { DemoNote, Plate, Rule, Screen } from '@/components/layout';
import { Money } from '@/components/money';
import { TxRow } from '@/components/tx-row';
import type { Tx } from '@/data/types';
import { dayLabel } from '@/lib/dates';
import { dailySpending, sortedTxs, summarize } from '@/lib/summary';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

type Filter = 'tudo' | 'entradas' | 'saidas';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'tudo', label: 'Tudo' },
  { key: 'entradas', label: 'Entradas' },
  { key: 'saidas', label: 'Saídas' },
];

export default function Extrato() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Filter>('tudo');
  const s = useMemo(() => summarize(state), [state]);
  const bars = useMemo(() => dailySpending(state), [state]);
  const accountsById = useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts]);

  const days = useMemo(() => {
    const list = sortedTxs(state).filter((t) =>
      filter === 'tudo' ? true : filter === 'entradas' ? t.amount > 0 : t.amount < 0,
    );
    const groups: { label: string; total: number; txs: Tx[] }[] = [];
    for (const t of list) {
      const label = dayLabel(t.date);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.txs.push(t);
        last.total += t.amount;
      } else groups.push({ label, total: t.amount, txs: [t] });
    }
    return groups;
  }, [state, filter]);

  return (
    <Screen title="Extrato" subtitle="Últimos 30 dias, todas as contas">
      <View style={styles.pad}>
        <View style={styles.totals}>
          <View style={{ flex: 1 }}>
            <T variant="caption" tone="ink2">
              Entrou
            </T>
            <Money value={s.entradas} variant="title3" tone="jade" />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="caption" tone="ink2">
              Saiu
            </T>
            <Money value={-s.gastos} variant="title3" />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="caption" tone="ink2">
              Guardou
            </T>
            <Money value={s.aportes + s.guardado} variant="title3" tone="lantern" />
          </View>
        </View>
        <View style={{ marginTop: 18 }}>
          <DayBars bars={bars} height={72} />
        </View>

        <View style={styles.segment} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const on = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.segBtn, on && styles.segOn]}>
                <T variant="calloutStrong" style={{ color: on ? color.night : color.ink2 }}>
                  {f.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      {days.map((d) => (
        <View key={d.label} style={styles.day}>
          <View style={styles.dayHead}>
            <T variant="captionStrong" tone="ink2" accessibilityRole="header">
              {d.label}
            </T>
            <Money value={d.total} variant="caption" tone="ink3" sign="always" />
          </View>
          <Plate style={{ paddingHorizontal: 14 }}>
            {d.txs.map((tx, i) => (
              <View key={tx.id}>
                {i > 0 && <Rule inset={50} />}
                <TxRow tx={tx} account={accountsById.get(tx.accountId)} />
              </View>
            ))}
          </Plate>
        </View>
      ))}
      {days.length === 0 && (
        <T variant="callout" tone="ink3" align="center" style={{ marginTop: 32 }}>
          Nada por aqui nos últimos 30 dias.
        </T>
      )}
      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: gutter },
  totals: { flexDirection: 'row', gap: 12 },
  segment: {
    flexDirection: 'row',
    marginTop: 26,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  segBtn: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segOn: { backgroundColor: color.lantern },
  day: { marginTop: 24, paddingHorizontal: gutter },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
});
