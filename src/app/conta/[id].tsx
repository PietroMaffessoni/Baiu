import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankMark } from '@/components/bank-mark';
import { Button } from '@/components/button';
import { DayBars } from '@/components/day-bars';
import { Plate, Rule } from '@/components/layout';
import { BigMoney } from '@/components/money';
import { TxRow } from '@/components/tx-row';
import { bankById, KIND_LABEL } from '@/data/banks';
import { brl } from '@/lib/money';
import { dailySpending, sortedTxs } from '@/lib/summary';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

export default function ContaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const account = state.accounts.find((a) => a.id === id);
  const txs = useMemo(() => sortedTxs(state, id), [state, id]);
  const bars = useMemo(() => dailySpending(state, new Date(), id), [state, id]);

  if (!account) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <T variant="body" tone="ink2">
          Esta conta não existe mais.
        </T>
      </View>
    );
  }

  const bank = bankById(account.bankId);
  const card = account.kind === 'cartao';
  const used = card && account.limit ? Math.min(1, account.balance / account.limit) : 0;

  const remove = () => {
    const doIt = () => {
      dispatch({ type: 'removeAccount', id: account.id });
      router.back();
    };
    const msg = 'Os movimentos desta conta saem do Baiu. Dá para cadastrar de novo depois.';
    if (Platform.OS === 'web') {
      doIt();
      return;
    }
    Alert.alert('Remover esta conta?', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: account.nickname ?? bank.name }} />

      <View style={styles.head}>
        <BankMark bankId={account.bankId} size={56} />
        <T variant="title2" style={{ marginTop: 14 }}>
          {account.nickname ?? bank.name}
        </T>
        <T variant="callout" tone="ink2">
          {account.nickname ? `${bank.name} · ` : ''}
          {KIND_LABEL[account.kind]}
        </T>
        <View style={{ marginTop: 18 }}>
          <T variant="caption" tone="ink2">
            {card ? 'Fatura atual' : 'Saldo'}
          </T>
          <BigMoney value={card ? -account.balance : account.balance} size={40} />
        </View>
        {card && account.limit ? (
          <View style={{ marginTop: 14 }}>
            <View style={styles.limitTrack}>
              <View style={[styles.limitFill, { width: `${used * 100}%` }]} />
            </View>
            <View style={styles.limitRow}>
              <T variant="caption" tone="ink2">
                Vence dia {account.dueDay}
              </T>
              <T variant="caption" tone="ink3" tabular>
                {state.hideValues ? 'Limite oculto' : `Limite ${brl(account.limit, { cents: false })}`}
              </T>
            </View>
          </View>
        ) : null}
      </View>

      {txs.length > 0 && (
        <View style={styles.pad}>
          <T variant="title3" style={{ marginBottom: 12 }} accessibilityRole="header">
            Gastos nos últimos 30 dias
          </T>
          <DayBars bars={bars} />
        </View>
      )}

      <View style={styles.pad}>
        <T variant="title3" style={{ marginBottom: 12 }} accessibilityRole="header">
          Movimentos
        </T>
        {txs.length === 0 ? (
          <Plate style={{ padding: 16 }}>
            <T variant="callout" tone="ink2">
              Nenhum movimento ainda. Quando a conta estiver conectada, cada Pix, compra e boleto aparece aqui.
            </T>
          </Plate>
        ) : (
          <Plate style={{ paddingHorizontal: 14 }}>
            {txs.map((tx, i) => (
              <View key={tx.id}>
                {i > 0 && <Rule inset={50} />}
                <TxRow tx={tx} showAccount={false} />
              </View>
            ))}
          </Plate>
        )}
      </View>

      {/* ação destrutiva sozinha, longe de tudo */}
      <View style={styles.danger}>
        <Button label="Remover conta" kind="danger" icon="trash" onPress={remove} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  missing: { alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: gutter, paddingTop: 12, alignItems: 'flex-start' },
  limitTrack: {
    height: 6,
    width: 260,
    maxWidth: '100%',
    borderRadius: 3,
    backgroundColor: color.plateHi,
    overflow: 'hidden',
  },
  limitFill: { height: 6, backgroundColor: color.lantern },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 260,
    maxWidth: '100%',
    marginTop: 6,
    gap: 12,
  },
  pad: { paddingHorizontal: gutter, marginTop: 34 },
  danger: { paddingHorizontal: gutter, marginTop: 72 },
});
