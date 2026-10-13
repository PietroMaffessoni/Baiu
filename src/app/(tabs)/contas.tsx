import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { BankMark } from '@/components/bank-mark';
import { Button, IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import { DemoNote, Plate, Rule, Screen } from '@/components/layout';
import { BigMoney, Money } from '@/components/money';
import { TxRow } from '@/components/tx-row';
import { bankById, KIND_LABEL } from '@/data/banks';
import type { Account, AccountKind } from '@/data/types';
import { brl } from '@/lib/money';
import { sortedTxs, summarize } from '@/lib/summary';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

const GROUPS: { kind: AccountKind; title: string }[] = [
  { kind: 'corrente', title: 'Contas correntes' },
  { kind: 'reserva', title: 'Reserva' },
  { kind: 'investimento', title: 'Investimentos' },
  { kind: 'cartao', title: 'Cartões de crédito' },
];

export default function Contas() {
  const { state } = useStore();
  const s = useMemo(() => summarize(state), [state]);
  const [focus, setFocus] = useState<string | null>(null);

  const parts = [
    { key: 'corrente', label: 'Disponível', value: s.corrente, tint: color.paper },
    { key: 'reserva', label: 'Reserva', value: s.reserva, tint: color.lanternCore },
    { key: 'investido', label: 'Investido', value: s.investido, tint: color.lantern },
  ];
  const whole = Math.max(
    1,
    parts.reduce((n, p) => n + p.value, 0),
  );

  return (
    <Screen
      title="Contas"
      subtitle={`${state.accounts.length} ${state.accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}`}
      right={
        <IconButton
          icon="plus"
          label="Adicionar conta"
          tint={color.lantern}
          onPress={() => router.push('/nova-conta')}
        />
      }>
      <View style={styles.pad}>
        <Plate style={styles.summary}>
          <T variant="caption" tone="ink2">
            Patrimônio líquido
          </T>
          <BigMoney value={s.patrimonio} size={36} />
          <View style={styles.stack} accessible accessibilityLabel="Composição do patrimônio">
            {parts.map((p) =>
              p.value > 0 ? (
                <View key={p.key} style={{ flex: p.value / whole, backgroundColor: p.tint, height: 8 }} />
              ) : null,
            )}
          </View>
          <View style={styles.legend}>
            {parts.map((p) => (
              <View key={p.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: p.tint }]} />
                <View>
                  <T variant="micro" tone="ink3">
                    {p.label}
                  </T>
                  <Money value={p.value} variant="captionStrong" />
                </View>
              </View>
            ))}
          </View>
          {s.fatura > 0 && (
            <View style={styles.faturaLine}>
              <Icon name="card" size={15} tint={color.ink2} />
              <T variant="caption" tone="ink2" style={{ flex: 1 }}>
                Faturas em aberto
              </T>
              <Money value={-s.fatura} variant="captionStrong" />
            </View>
          )}
        </Plate>
      </View>

      {GROUPS.map((g) => {
        const list = state.accounts.filter((a) => a.kind === g.kind);
        if (list.length === 0) return null;
        return (
          <View key={g.kind} style={styles.group}>
            <T variant="title3" tone="ink2" style={styles.groupTitle} accessibilityRole="header">
              {g.title}
            </T>
            <Plate style={{ paddingHorizontal: 14 }}>
              {list.map((a, i) => (
                <View key={a.id}>
                  {i > 0 && <Rule inset={54} />}
                  <AccountRow
                    account={a}
                    focused={focus === a.id}
                    dimmed={focus !== null && focus !== a.id}
                    onPress={() => setFocus((f) => (f === a.id ? null : a.id))}
                  />
                </View>
              ))}
            </Plate>
          </View>
        );
      })}

      <View style={[styles.pad, { marginTop: 32, gap: 12 }]}>
        <Button label="Adicionar conta" icon="plus" onPress={() => router.push('/nova-conta')} />
        <View style={styles.soon}>
          <Icon name="link" size={15} tint={color.ink3} />
          <T variant="caption" tone="ink3" style={{ flex: 1 }}>
            Conexão automática com os bancos pelo Open Finance chega numa próxima versão. Por enquanto, você informa o
            saldo.
          </T>
        </View>
      </View>
      <DemoNote />
    </Screen>
  );
}

function AccountRow({
  account,
  focused,
  dimmed,
  onPress,
}: {
  account: Account;
  focused: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const { state } = useStore();
  const bank = bankById(account.bankId);
  const card = account.kind === 'cartao';
  const txs = useMemo(() => (focused ? sortedTxs(state, account.id).slice(0, 3) : []), [focused, state, account.id]);

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={{ opacity: dimmed ? 0.38 : 1 }}>
      <Pressable
        onPress={onPress}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: focused }}
        accessibilityLabel={`${account.nickname ?? bank.name}, ${KIND_LABEL[account.kind]}`}>
        <BankMark bankId={account.bankId} size={40} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong" numberOfLines={1}>
            {account.nickname ?? bank.name}
          </T>
          <T variant="caption" tone="ink3" numberOfLines={1}>
            {card
              ? `Vence dia ${account.dueDay}`
              : account.nickname
                ? `${bank.name} · ${KIND_LABEL[account.kind]}`
                : KIND_LABEL[account.kind]}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Money value={card ? -account.balance : account.balance} variant="bodyStrong" />
          {card && account.limit ? (
            <T variant="micro" tone="ink3">
              {state.hideValues ? 'limite oculto' : `limite ${brl(account.limit, { cents: false })}`}
            </T>
          ) : null}
        </View>
      </Pressable>
      {focused && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={styles.expand}>
          {txs.length === 0 ? (
            <T variant="caption" tone="ink3" style={{ paddingVertical: 8 }}>
              Nenhum movimento registrado nesta conta ainda.
            </T>
          ) : (
            txs.map((tx) => <TxRow key={tx.id} tx={tx} showAccount={false} />)
          )}
          <Link href={{ pathname: '/conta/[id]', params: { id: account.id } }} asChild>
            <Pressable style={styles.open} accessibilityRole="button">
              <T variant="calloutStrong" tone="lantern">
                Abrir conta
              </T>
              <Icon name="chevron" size={13} tint={color.lantern} weight="semibold" />
            </Pressable>
          </Link>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: gutter },
  summary: { padding: 18, gap: 4 },
  stack: { flexDirection: 'row', gap: 3, marginTop: 14, borderRadius: 4, overflow: 'hidden' },
  legend: { flexDirection: 'row', marginTop: 12, gap: 8 },
  legendItem: { flex: 1, flexDirection: 'row', gap: 7 },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  faturaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  group: { marginTop: 28, paddingHorizontal: gutter },
  groupTitle: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingVertical: 12 },
  expand: { paddingLeft: 54, paddingBottom: 8 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  soon: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
