import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/button';
import { DayBars } from '@/components/day-bars';
import { Chips, EmptyPlate } from '@/components/form';
import { DemoNote, Plate, Rule, Screen } from '@/components/layout';
import { Money } from '@/components/money';
import { TxRow } from '@/components/tx-row';
import type { Tx } from '@/data/types';
import { dayLabel, MESES_CURTOS } from '@/lib/dates';
import { signedAmount } from '@/lib/ledger';
import { dailySpending, flowsIn, periodsFor, sortedTxs } from '@/lib/summary';
import { useAccountsById, useStore } from '@/store/store';
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
  const accountsById = useAccountsById();
  const [filter, setFilter] = useState<Filter>('tudo');
  const periods = useMemo(() => periodsFor(new Date(), 12), []);
  const [periodKey, setPeriodKey] = useState(periods[0].key);
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];

  const flows = useMemo(() => flowsIn(state, period), [state, period]);
  const bars = useMemo(() => dailySpending(state, period), [state, period]);

  const days = useMemo(() => {
    const list = sortedTxs(state).filter((t) => {
      const d = new Date(t.date);
      if (d < period.start || d >= period.end) return false;
      if (filter === 'entradas') return t.kind === 'entrada';
      if (filter === 'saidas') return t.kind === 'saida';
      return true;
    });
    const groups: { label: string; total: number; txs: Tx[] }[] = [];
    for (const t of list) {
      const label = dayLabel(t.date);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.txs.push(t);
        last.total += signedAmount(t);
      } else groups.push({ label, total: signedAmount(t), txs: [t] });
    }
    return groups;
  }, [state, filter, period]);

  const chipLabel = (i: number) => {
    if (i === 0) return '30 dias';
    const p = periods[i];
    const m = MESES_CURTOS[p.start.getMonth()];
    const label = `${m[0].toUpperCase()}${m.slice(1)}`;
    return p.start.getFullYear() !== new Date().getFullYear()
      ? `${label} ${String(p.start.getFullYear()).slice(2)}`
      : label;
  };

  const barLabels: [string, string] | null =
    period.key === '30d' ? ['30 dias atrás', 'hoje'] : [`1 ${MESES_CURTOS[period.start.getMonth()]}`, 'fim do mês'];

  return (
    <Screen
      title="Extrato"
      subtitle={`${period.label}, todas as contas`}
      right={
        <IconButton
          icon="plus"
          label="Registrar movimento"
          tint={color.lantern}
          onPress={() => router.push(state.accounts.length ? '/movimento/novo' : '/nova-conta')}
        />
      }>
      <View style={{ paddingLeft: gutter, marginBottom: 20 }}>
        <Chips
          scroll
          options={periods.map((p, i) => ({ value: p.key, label: chipLabel(i) }))}
          value={periodKey}
          onChange={setPeriodKey}
        />
      </View>

      <View style={styles.pad}>
        <View style={styles.totals}>
          <View style={{ flex: 1 }}>
            <T variant="caption" tone="ink2">
              Entrou
            </T>
            <Money value={flows.entradas} variant="title3" tone="jade" />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="caption" tone="ink2">
              Saiu
            </T>
            <Money value={-flows.gastos} variant="title3" />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="caption" tone="ink2">
              Guardou
            </T>
            <Money value={flows.aportes + flows.guardado} variant="title3" tone="lantern" />
          </View>
        </View>
        <View style={{ marginTop: 18 }}>
          <DayBars bars={bars} height={72} labels={barLabels} />
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
                <TxRow
                  tx={tx}
                  accounts={accountsById}
                  onPress={() => router.push({ pathname: '/movimento/[id]', params: { id: tx.id } })}
                />
              </View>
            ))}
          </Plate>
        </View>
      ))}
      {days.length === 0 && (
        <View style={[styles.pad, { marginTop: 28 }]}>
          <EmptyPlate
            text={
              state.txs.length === 0
                ? 'Nenhum movimento registrado ainda. Toque no + para registrar uma entrada, um gasto ou uma transferência.'
                : 'Nada neste período.'
            }
          />
        </View>
      )}
      {state.demo && <DemoNote />}
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
