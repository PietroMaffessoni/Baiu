import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BankMark } from '@/components/bank-mark';
import { DemoNote, Plate, Rule, Screen, Section } from '@/components/layout';
import { Mark } from '@/components/mark';
import { BigMoney, Money } from '@/components/money';
import { bankById } from '@/data/banks';
import { MESES_CURTOS } from '@/lib/dates';
import { pct } from '@/lib/money';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

export default function Investir() {
  const { state } = useStore();
  const accounts = state.accounts.filter((a) => a.kind === 'investimento');
  const total = accounts.reduce((n, a) => n + a.balance, 0);

  const monthGain = useMemo(() => state.holdings.reduce((n, h) => n + h.value * h.monthReturn, 0), [state.holdings]);
  const monthPct = total > 0 ? monthGain / (total - monthGain) : 0;

  const now = new Date();
  const months = state.contributions.map((v, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (state.contributions.length - 1 - i), 1);
    return { label: MESES_CURTOS[d.getMonth()].slice(0, 1).toUpperCase(), full: MESES_CURTOS[d.getMonth()], value: v };
  });
  const filled = months.filter((m) => m.value > 0).length;

  return (
    <Screen
      title="Investimentos"
      subtitle={`${accounts.length} ${accounts.length === 1 ? 'conta' : 'contas'} de investimento`}>
      <View style={styles.pad}>
        <BigMoney value={total} size={40} />
        <View style={styles.gain}>
          <Money value={monthGain} variant="calloutStrong" tone={monthGain >= 0 ? 'jade' : 'vermilion'} sign="always" />
          <T variant="callout" tone="ink2">
            este mês ({monthPct >= 0 ? '+' : ''}
            {pct(monthPct, 2)})
          </T>
        </View>
      </View>

      <Section title="Constância">
        <Plate style={{ padding: 16 }}>
          <T variant="callout" tone="ink2">
            Investiu em <T variant="calloutStrong">{filled} de 12 meses</T>. Cada mês com aporte acende uma marca.
          </T>
          <View style={styles.months}>
            {months.map((m, i) => (
              <View
                key={i}
                style={styles.monthCell}
                accessible
                accessibilityLabel={`${m.full}: ${m.value > 0 ? 'com aporte' : 'sem aporte'}`}>
                <Mark state={m.value > 0 ? 'cheia' : 'vazia'} size={20} />
                <T variant="micro" tone={i === months.length - 1 ? 'lantern' : 'ink3'}>
                  {m.label}
                </T>
              </View>
            ))}
          </View>
        </Plate>
      </Section>

      <Section title="Carteira">
        {accounts.map((a) => {
          const hs = state.holdings.filter((h) => h.accountId === a.id);
          return (
            <View key={a.id} style={{ marginBottom: 16 }}>
              <View style={styles.broker}>
                <BankMark bankId={a.bankId} size={28} />
                <T variant="captionStrong" tone="ink2" style={{ flex: 1 }}>
                  {a.nickname ?? bankById(a.bankId).name}
                </T>
                <Money value={a.balance} variant="captionStrong" tone="ink2" />
              </View>
              <Plate style={{ paddingHorizontal: 14 }}>
                {hs.length === 0 ? (
                  <T variant="caption" tone="ink3" style={{ paddingVertical: 14 }}>
                    Saldo informado manualmente. Os ativos aparecem quando a conta for conectada.
                  </T>
                ) : (
                  hs.map((h, i) => (
                    <View key={h.id}>
                      {i > 0 && <Rule />}
                      <View style={styles.holding}>
                        <View style={styles.kind}>
                          <T variant="micro" tone="ink2">
                            {h.kind}
                          </T>
                        </View>
                        <View style={{ flex: 1 }}>
                          <T variant="calloutStrong" numberOfLines={1}>
                            {h.name}
                          </T>
                          <T variant="caption" tone="ink3" tabular>
                            {pct(h.value / Math.max(1, a.balance), 0)} da carteira
                          </T>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Money value={h.value} variant="calloutStrong" />
                          <T variant="caption" tone={h.monthReturn >= 0 ? 'jade' : 'vermilion'} tabular>
                            {h.monthReturn >= 0 ? '+' : '−'}
                            {pct(Math.abs(h.monthReturn), 2)}
                          </T>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </Plate>
            </View>
          );
        })}
        {accounts.length === 0 && (
          <T variant="callout" tone="ink3">
            Nenhuma conta de investimento ainda. Adicione uma em Contas.
          </T>
        )}
      </Section>
      <DemoNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: gutter },
  gain: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  months: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  monthCell: { alignItems: 'center', gap: 6 },
  broker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  holding: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  kind: {
    minWidth: 54,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
    alignItems: 'center',
  },
});
