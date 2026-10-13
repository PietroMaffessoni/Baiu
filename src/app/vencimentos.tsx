import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyPlate } from '@/components/form';
import { Icon } from '@/components/icon';
import { Plate, Rule } from '@/components/layout';
import { Mark, type MarkState } from '@/components/mark';
import { Money } from '@/components/money';
import { dueItems, dueLabel, paidLabel, type DueItem } from '@/lib/bills';
import { addDays } from '@/lib/dates';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

export default function Vencimentos() {
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const items = useMemo(() => dueItems(state), [state]);
  const overdue = items.filter((i) => i.overdue);
  const open = items.filter((i) => !i.overdue);
  const paid = useMemo(() => {
    const since = addDays(new Date(), -45);
    return state.bills
      .filter((b) => b.paid && b.paidAt && new Date(b.paidAt) >= since)
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));
  }, [state.bills]);

  const open_ = (i: DueItem) =>
    i.billId
      ? router.push({ pathname: '/vencimento/[id]', params: { id: i.billId } })
      : router.push({ pathname: '/conta/[id]', params: { id: i.accountId! } });

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Adicionar vencimento"
              onPress={() => router.push('/vencimento/novo')}>
              <Icon name="plus" size={20} tint={color.lantern} weight="semibold" />
            </Pressable>
          ),
        }}
      />

      <View style={styles.pad}>
        <T variant="callout" tone="ink2">
          {state.settings.reminders
            ? 'O Baiu avisa um dia antes e no dia do vencimento, às 9h, sem mostrar valores na notificação.'
            : 'Os lembretes estão desligados. Ligue em Ajustes para ser avisado antes de cada vencimento.'}
        </T>
      </View>

      {items.length === 0 && paid.length === 0 && (
        <View style={[styles.pad, { marginTop: 24 }]}>
          <EmptyPlate text="Nada a pagar por aqui. Cadastre boletos, aluguel e contas fixas. Os recorrentes se renovam sozinhos a cada pagamento.">
            <Button label="Adicionar vencimento" icon="plus" onPress={() => router.push('/vencimento/novo')} />
          </EmptyPlate>
        </View>
      )}

      <Group title="Atrasados" items={overdue} state="riscada" onPress={open_} />
      <Group title="A pagar" items={open} state="vazia" onPress={open_} />

      {paid.length > 0 && (
        <View style={styles.group}>
          <T variant="title3" tone="ink2" style={styles.groupTitle} accessibilityRole="header">
            Pagos recentemente
          </T>
          <Plate style={{ paddingHorizontal: 14 }}>
            {paid.map((b, i) => (
              <View key={b.id}>
                {i > 0 && <Rule inset={36} />}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/vencimento/[id]', params: { id: b.id } })}>
                  <Mark state="cheia" />
                  <View style={{ flex: 1 }}>
                    <T variant="calloutStrong" numberOfLines={1}>
                      {b.title}
                    </T>
                    <T variant="caption" tone="ink3">
                      {paidLabel(b.paidAt!)}
                    </T>
                  </View>
                  <Money value={-b.amount} variant="calloutStrong" tone="ink2" />
                </Pressable>
              </View>
            ))}
          </Plate>
        </View>
      )}
    </ScrollView>
  );
}

function Group({
  title,
  items,
  state,
  onPress,
}: {
  title: string;
  items: DueItem[];
  state: MarkState;
  onPress: (i: DueItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <T
        variant="title3"
        tone={state === 'riscada' ? 'vermilion' : 'ink2'}
        style={styles.groupTitle}
        accessibilityRole="header">
        {title}
      </T>
      <Plate style={{ paddingHorizontal: 14 }}>
        {items.map((d, i) => (
          <View key={d.key}>
            {i > 0 && <Rule inset={36} />}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              onPress={() => onPress(d)}>
              <Mark state={state} />
              <View style={{ flex: 1 }}>
                <T variant="calloutStrong" numberOfLines={1}>
                  {d.title}
                </T>
                <T variant="caption" tone={d.overdue ? 'vermilion' : 'ink3'}>
                  {dueLabel(d.due)}
                  {d.kind === 'card' ? ' · fatura do cartão' : ''}
                </T>
              </View>
              <Money value={-d.amount} variant="calloutStrong" />
            </Pressable>
          </View>
        ))}
      </Plate>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: gutter },
  group: { marginTop: 28, paddingHorizontal: gutter },
  groupTitle: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 },
});
