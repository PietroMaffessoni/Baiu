import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BankMark } from '@/components/bank-mark';
import { Button, IconButton } from '@/components/button';
import { EmptyPlate } from '@/components/form';
import { Icon } from '@/components/icon';
import { DemoNote, Plate, Rule, Screen, Section } from '@/components/layout';
import { Mark } from '@/components/mark';
import { BigMoney, Money } from '@/components/money';
import { bankById } from '@/data/banks';
import { MESES_CURTOS } from '@/lib/dates';
import { accountTotal } from '@/lib/ledger';
import { pct } from '@/lib/money';
import { monthlyAportes, monthYield } from '@/lib/summary';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

export default function Investir() {
  const { state } = useStore();
  const accounts = state.accounts.filter((a) => a.kind === 'investimento');
  const total = accounts.reduce((n, a) => n + accountTotal(a, state.holdings), 0);

  const gain = monthYield(state);
  const base = total - gain;
  const gainPct = base > 0 ? gain / base : 0;

  const months = monthlyAportes(state);
  const filled = months.filter((m) => m.value > 0).length;

  const add = () =>
    accounts.length
      ? router.push('/investimento/novo')
      : router.push({ pathname: '/nova-conta', params: { kind: 'investimento' } });

  return (
    <Screen
      title="Investimentos"
      subtitle={
        accounts.length
          ? `${accounts.length} ${accounts.length === 1 ? 'conta' : 'contas'} de investimento`
          : 'Nenhuma conta de investimento ainda'
      }
      right={<IconButton icon="plus" label="Adicionar investimento" tint={color.lantern} onPress={add} />}>
      {accounts.length === 0 ? (
        <View style={styles.pad}>
          <EmptyPlate text="Cadastre a conta da sua corretora ou banco de investimentos. Depois, adicione cada aplicação: Tesouro, CDB, fundos, ações.">
            <Button
              label="Adicionar corretora"
              kind="secondary"
              icon="plus"
              onPress={() => router.push({ pathname: '/nova-conta', params: { kind: 'investimento' } })}
            />
          </EmptyPlate>
        </View>
      ) : (
        <View style={styles.pad}>
          <BigMoney value={total} size={40} />
          {gain !== 0 ? (
            <View style={styles.gain}>
              <Money value={gain} variant="calloutStrong" tone={gain >= 0 ? 'jade' : 'vermilion'} sign="always" />
              <T variant="callout" tone="ink2">
                este mês ({gainPct >= 0 ? '+' : '−'}
                {pct(Math.abs(gainPct), 2)})
              </T>
            </View>
          ) : (
            <T variant="callout" tone="ink2" style={{ marginTop: 2 }}>
              Atualize o valor dos ativos para ver quanto renderam.
            </T>
          )}
        </View>
      )}

      <Section title="Constância">
        <Plate style={{ padding: 16 }}>
          <T variant="callout" tone="ink2">
            Investiu em <T variant="calloutStrong">{filled} de 12 meses</T>. Cada mês com aporte acende uma marca.
          </T>
          <View style={styles.months}>
            {months.map((m, i) => {
              const name = MESES_CURTOS[m.period.start.getMonth()];
              return (
                <View
                  key={m.period.key}
                  style={styles.monthCell}
                  accessible
                  accessibilityLabel={`${name}: ${m.value > 0 ? 'com aporte' : 'sem aporte'}`}>
                  <Mark state={m.value > 0 ? 'cheia' : 'vazia'} size={20} />
                  <T variant="micro" tone={i === months.length - 1 ? 'lantern' : 'ink3'}>
                    {name[0].toUpperCase()}
                  </T>
                </View>
              );
            })}
          </View>
          <T variant="caption" tone="ink3" style={{ marginTop: 12 }}>
            Conta como aporte toda transferência para uma conta de investimento.
          </T>
        </Plate>
      </Section>

      {accounts.length > 0 && (
        <Section title="Carteira">
          {accounts.map((a) => {
            const hs = state.holdings.filter((h) => h.accountId === a.id);
            const accTotal = accountTotal(a, state.holdings);
            return (
              <View key={a.id} style={{ marginBottom: 18 }}>
                <Pressable
                  style={styles.broker}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/conta/[id]', params: { id: a.id } })}>
                  <BankMark bankId={a.bankId} size={28} />
                  <T variant="captionStrong" tone="ink2" style={{ flex: 1 }}>
                    {a.nickname ?? bankById(a.bankId).name}
                  </T>
                  <Money value={accTotal} variant="captionStrong" tone="ink2" />
                </Pressable>
                <Plate style={{ paddingHorizontal: 14 }}>
                  {hs.map((h, i) => {
                    const result = h.value - h.invested;
                    return (
                      <View key={h.id}>
                        {i > 0 && <Rule />}
                        <Pressable
                          style={({ pressed }) => [styles.holding, pressed && { opacity: 0.6 }]}
                          accessibilityRole="button"
                          onPress={() => router.push({ pathname: '/investimento/[id]', params: { id: h.id } })}>
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
                              {pct(accTotal > 0 ? h.value / accTotal : 0, 0)} da carteira
                            </T>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Money value={h.value} variant="calloutStrong" />
                            {h.invested > 0 && Math.abs(result) >= 0.01 ? (
                              <T variant="caption" tone={result >= 0 ? 'jade' : 'vermilion'} tabular>
                                {result >= 0 ? '+' : '−'}
                                {pct(Math.abs(result) / h.invested, 2)}
                              </T>
                            ) : null}
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                  {a.balance > 0.004 && (
                    <View>
                      {hs.length > 0 && <Rule />}
                      <View style={styles.holding}>
                        <View style={styles.kind}>
                          <T variant="micro" tone="ink2">
                            Caixa
                          </T>
                        </View>
                        <T variant="calloutStrong" style={{ flex: 1 }}>
                          Saldo parado
                        </T>
                        <Money value={a.balance} variant="calloutStrong" />
                      </View>
                    </View>
                  )}
                  {hs.length > 0 || a.balance > 0.004 ? <Rule /> : null}
                  <Pressable
                    style={styles.addRow}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/investimento/novo', params: { accountId: a.id } })}>
                    <Icon name="plus" size={15} tint={color.lantern} weight="semibold" />
                    <T variant="calloutStrong" tone="lantern">
                      Adicionar investimento
                    </T>
                  </Pressable>
                </Plate>
              </View>
            );
          })}
          <T variant="caption" tone="ink3">
            Os valores são os que você informa. O Baiu não consulta cotações nem faz recomendação de investimento.
          </T>
        </Section>
      )}
      {state.demo && <DemoNote />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: gutter },
  gain: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  months: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  monthCell: { alignItems: 'center', gap: 6 },
  broker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, minHeight: 36 },
  holding: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, minHeight: 60 },
  kind: {
    minWidth: 54,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
    alignItems: 'center',
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48 },
});
