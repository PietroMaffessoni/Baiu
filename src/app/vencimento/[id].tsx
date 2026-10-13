import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { AccountChips, DateField, FieldLabel, ListRow } from '@/components/form';
import { Plate, Rule } from '@/components/layout';
import { Mark } from '@/components/mark';
import { BigMoney } from '@/components/money';
import { bankById } from '@/data/banks';
import { CATEGORY } from '@/data/categories';
import { dueLabel, paidLabel } from '@/lib/bills';
import { DIAS, MESES } from '@/lib/dates';
import { isOverdue } from '@/lib/folego';
import { close } from '@/lib/nav';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

export default function VencimentoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const bill = state.bills.find((b) => b.id === id);
  const payers = state.accounts.filter((a) => a.kind !== 'investimento');
  const [payWith, setPayWith] = useState<string | null>(
    bill?.accountId && payers.some((a) => a.id === bill.accountId) ? bill.accountId : (payers[0]?.id ?? null),
  );
  const [date, setDate] = useState(() => new Date());

  if (!bill) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <T variant="body" tone="ink2">
          Este vencimento foi apagado.
        </T>
      </View>
    );
  }

  const due = new Date(bill.dueDate);
  const overdue = isOverdue(bill);

  const pay = () => {
    if (!payWith) return;
    dispatch({ type: 'payBill', id: bill.id, accountId: payWith, date: date.toISOString() });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    close();
  };

  const remove = () => {
    const go = () => {
      dispatch({ type: 'removeBill', id: bill.id });
      close();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert(
      'Apagar este vencimento?',
      bill.paid ? 'O movimento do pagamento continua no extrato.' : 'Os lembretes dele também são cancelados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: go },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: 28, paddingBottom: insets.bottom + 40 }}>
      <View style={styles.pad}>
        <View style={styles.status}>
          <Mark state={bill.paid ? 'cheia' : overdue ? 'riscada' : 'vazia'} />
          <T variant="captionStrong" tone={bill.paid ? 'lantern' : overdue ? 'vermilion' : 'ink2'}>
            {bill.paid && bill.paidAt ? paidLabel(bill.paidAt) : dueLabel(due)}
          </T>
        </View>
        <T variant="title2" style={{ marginTop: 10 }}>
          {bill.title}
        </T>
        <View style={{ marginTop: -10 }}>
          <BigMoney value={-bill.amount} size={38} />
        </View>

        <Plate style={{ paddingHorizontal: 14, marginTop: 18 }}>
          <ListRow label="Vencimento" value={`${DIAS[due.getDay()]}, ${due.getDate()} de ${MESES[due.getMonth()]}`} />
          <Rule />
          <ListRow label="Categoria" value={CATEGORY[bill.category].label} />
          <Rule />
          <ListRow label="Repete todo mês" value={bill.repeatMonthly ? 'Sim' : 'Não'} />
        </Plate>
      </View>

      {!bill.paid && (
        <>
          <View style={styles.padLeft}>
            <FieldLabel>Pagar com</FieldLabel>
            <AccountChips accounts={payers} value={payWith} onChange={setPayWith} />
          </View>
          <View style={styles.pad}>
            <FieldLabel>Pago em</FieldLabel>
            <DateField value={date} onChange={setDate} />
            <View style={{ marginTop: 22 }}>
              <Button label="Marcar como pago" icon="check" disabled={!payWith} onPress={pay} />
            </View>
            {payWith && (
              <T variant="caption" tone="ink3" style={{ marginTop: 8 }}>
                Vira uma saída em{' '}
                {(() => {
                  const a = state.accounts.find((x) => x.id === payWith);
                  return a ? (a.nickname ?? bankById(a.bankId).name) : '';
                })()}
                {bill.repeatMonthly ? ' e o vencimento do mês seguinte já fica cadastrado.' : '.'}
              </T>
            )}
          </View>
        </>
      )}

      <View style={[styles.pad, { marginTop: 14, gap: 10 }]}>
        {bill.paid && bill.paidTxId && state.txs.some((t) => t.id === bill.paidTxId) ? (
          <Button
            label="Ver o pagamento"
            kind="secondary"
            onPress={() => router.replace({ pathname: '/movimento/[id]', params: { id: bill.paidTxId! } })}
          />
        ) : null}
        {!bill.paid && (
          <Button
            label="Editar"
            kind="quiet"
            icon="edit"
            onPress={() => router.replace({ pathname: '/vencimento/novo', params: { id: bill.id } })}
          />
        )}
      </View>

      <View style={[styles.pad, { marginTop: 48 }]}>
        <Button label="Apagar vencimento" kind="danger" icon="trash" onPress={remove} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.nightDeep },
  pad: { paddingHorizontal: gutter },
  padLeft: { paddingLeft: gutter },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
