import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankMark } from '@/components/bank-mark';
import { Button } from '@/components/button';
import { DayBars } from '@/components/day-bars';
import { EmptyPlate } from '@/components/form';
import { Plate, Rule } from '@/components/layout';
import { BigMoney } from '@/components/money';
import { TxRow } from '@/components/tx-row';
import { bankById, KIND_LABEL } from '@/data/banks';
import { useBank, useBankStatus } from '@/lib/bank/use-bank';
import { dueLabel, nextCardDue } from '@/lib/bills';
import { agoLabel } from '@/lib/dates';
import { accountTotal } from '@/lib/ledger';
import { brl } from '@/lib/money';
import { dailySpending, last30, sortedTxs } from '@/lib/summary';
import { close } from '@/lib/nav';
import { useAccountsById, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

export default function ContaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const accountsById = useAccountsById();
  const insets = useSafeAreaInsets();
  const account = state.accounts.find((a) => a.id === id);
  const txs = useMemo(() => sortedTxs(state, id), [state, id]);
  const bars = useMemo(() => dailySpending(state, last30(), new Date(), id), [state, id]);
  const { refresh } = useBank();
  const bankStatus = useBankStatus();

  if (!account) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <Stack.Screen options={{ title: '' }} />
        <T variant="body" tone="ink2">
          Esta conta não existe mais.
        </T>
      </View>
    );
  }

  const bank = bankById(account.bankId);
  const card = account.kind === 'cartao';
  const invest = account.kind === 'investimento';
  const used = card && account.limit ? Math.min(1, Math.max(0, account.balance) / account.limit) : 0;
  const hide = state.settings.hideValues;
  const item = account.link ? state.bank.items.find((i) => i.id === account.link!.item) : undefined;

  const remove = () => {
    const doIt = () => {
      dispatch({ type: 'removeAccount', id: account.id });
      close();
    };
    const msg = item
      ? `A conta e os ${txs.length} movimentos dela saem do Baiu e não voltam nas próximas atualizações de ${item.name}. As outras contas desse banco continuam conectadas.`
      : `Os ${txs.length} movimentos ligados a esta conta também saem do Baiu. Isso não pode ser desfeito.`;
    if (Platform.OS === 'web') return doIt();
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
      <Stack.Screen
        options={{
          title: account.nickname ?? bank.name,
          headerRight: () =>
            item ? null : (
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/conta-editar', params: { id: account.id } })}>
                <T variant="body" tone="lantern">
                  Editar
                </T>
              </Pressable>
            ),
        }}
      />

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
            {card ? 'Fatura atual' : invest ? 'Total na corretora' : 'Saldo'}
          </T>
          <BigMoney value={card ? -account.balance : accountTotal(account, state.holdings)} size={40} />
        </View>
        {card && account.dueDay ? (
          <View style={{ marginTop: 14, alignSelf: 'stretch' }}>
            {account.limit ? (
              <View style={styles.limitTrack}>
                <View style={[styles.limitFill, { width: `${used * 100}%` }]} />
              </View>
            ) : null}
            <View style={styles.limitRow}>
              <T variant="caption" tone="ink2">
                {account.balance > 0 ? dueLabel(nextCardDue(account.dueDay)) : `Vence dia ${account.dueDay}`}
              </T>
              {account.limit ? (
                <T variant="caption" tone="ink3" tabular>
                  {hide ? 'Limite oculto' : `Limite ${brl(account.limit, { cents: false })}`}
                </T>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {item ? (
        <View style={styles.actions}>
          <View style={styles.linked}>
            <T variant="caption" tone="ink2" align="center">
              {`Conectada pelo Open Finance${account.link?.last4 ? ` · final ${account.link.last4}` : ''} · atualizada ${agoLabel(item.syncedAt)}`}
            </T>
            <T variant="caption" tone="ink3" align="center">
              Saldo e movimentos vêm do banco. Para corrigir uma categoria, toque no movimento.
            </T>
          </View>
          <Button
            label={bankStatus.running ? 'Atualizando…' : 'Atualizar agora'}
            kind="secondary"
            icon="undo"
            disabled={bankStatus.running}
            onPress={() => refresh(item.id)}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          {card && account.balance > 0 ? (
            <Button
              label="Pagar fatura"
              onPress={() =>
                router.push({
                  pathname: '/movimento/novo',
                  params: {
                    kind: 'transferencia',
                    toAccountId: account.id,
                    cents: String(Math.round(account.balance * 100)),
                  },
                })
              }
            />
          ) : null}
          {invest ? (
            <Button
              label="Adicionar investimento"
              icon="plus"
              onPress={() => router.push({ pathname: '/investimento/novo', params: { accountId: account.id } })}
            />
          ) : null}
          <Button
            label={card ? 'Registrar compra' : 'Registrar movimento'}
            kind={(card && account.balance > 0) || invest ? 'secondary' : 'primary'}
            icon="plus"
            onPress={() =>
              router.push({ pathname: '/movimento/novo', params: { accountId: account.id, kind: card ? 'saida' : '' } })
            }
          />
        </View>
      )}

      {txs.length > 0 && (
        <View style={styles.pad}>
          <T variant="title3" style={{ marginBottom: 12 }} accessibilityRole="header">
            {card ? 'Compras nos últimos 30 dias' : 'Gastos nos últimos 30 dias'}
          </T>
          <DayBars bars={bars} />
        </View>
      )}

      <View style={styles.pad}>
        <T variant="title3" style={{ marginBottom: 12 }} accessibilityRole="header">
          Movimentos
        </T>
        {txs.length === 0 ? (
          <EmptyPlate text="Nenhum movimento nesta conta ainda. Cada Pix, compra e boleto que você registrar aparece aqui." />
        ) : (
          <Plate style={{ paddingHorizontal: 14 }}>
            {txs.map((tx, i) => (
              <View key={tx.id}>
                {i > 0 && <Rule inset={50} />}
                <TxRow
                  tx={tx}
                  accounts={accountsById}
                  perspective={account.id}
                  showAccount={false}
                  onPress={() => router.push({ pathname: '/movimento/[id]', params: { id: tx.id } })}
                />
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
  linked: { gap: 2, marginBottom: 4 },
  screen: { flex: 1, backgroundColor: color.night },
  missing: { alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: gutter, paddingTop: 12, alignItems: 'flex-start' },
  limitTrack: { height: 6, borderRadius: 3, backgroundColor: color.plateHi, overflow: 'hidden' },
  limitFill: { height: 6, backgroundColor: color.lantern },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 12 },
  actions: { paddingHorizontal: gutter, marginTop: 24, gap: 10 },
  pad: { paddingHorizontal: gutter, marginTop: 34 },
  danger: { paddingHorizontal: gutter, marginTop: 72 },
});
