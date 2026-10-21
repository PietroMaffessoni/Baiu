import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CategoryGrid, ListRow } from '@/components/form';
import { Icon } from '@/components/icon';
import { Plate, Rule } from '@/components/layout';
import { BigMoney } from '@/components/money';
import { bankById } from '@/data/banks';
import { CATEGORY, IN_CATEGORIES, METHOD_LABEL, OUT_CATEGORIES } from '@/data/categories';
import type { Account } from '@/data/types';
import { DIAS, MESES } from '@/lib/dates';
import { signedAmount } from '@/lib/ledger';
import { close } from '@/lib/nav';
import { useAccountsById, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

const nameOf = (a?: Account) => (a ? (a.nickname ?? bankById(a.bankId).name) : 'Conta removida');
const TIPO = { saida: 'Saída', entrada: 'Entrada', transferencia: 'Transferência' } as const;

export default function MovimentoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const byId = useAccountsById();
  const insets = useSafeAreaInsets();
  const tx = state.txs.find((t) => t.id === id);
  const [picking, setPicking] = useState(false);

  if (!tx) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <T variant="body" tone="ink2">
          Este movimento foi apagado.
        </T>
      </View>
    );
  }

  const cat = CATEGORY[tx.category];
  const d = new Date(tx.date);
  const bill = tx.billId ? state.bills.find((b) => b.id === tx.billId) : undefined;
  const signed = signedAmount(tx);
  const item = tx.ext ? state.bank.items.find((i) => i.id === tx.ext!.item) : undefined;
  const imported = !!tx.ext;

  const remove = () => {
    const go = () => {
      dispatch({ type: 'removeTx', id: tx.id });
      close();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert(
      'Apagar este movimento?',
      imported
        ? 'Ele continua no banco, mas sai do Baiu e não volta nas próximas atualizações. O saldo não muda: ele vem do banco.'
        : bill
          ? 'O vencimento ligado a ele volta para "a pagar". Os saldos voltam ao que eram.'
          : 'Os saldos voltam ao que eram antes dele.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: go },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: 28, paddingBottom: insets.bottom + 40 }}>
      <View style={styles.pad}>
        <View style={[styles.glyph, tx.kind === 'entrada' && styles.glyphIn]}>
          <Icon name={cat.icon} size={24} tint={tx.kind === 'entrada' ? color.jade : color.ink2} />
        </View>
        <T variant="title2" style={{ marginTop: 14 }}>
          {tx.description || cat.label}
        </T>
        <View style={{ marginTop: -10 }}>
          <BigMoney value={signed === 0 ? tx.amount : signed} size={38} />
        </View>

        <Plate style={{ paddingHorizontal: 14, marginTop: 18 }}>
          <ListRow label="Tipo" value={TIPO[tx.kind]} />
          <Rule />
          {tx.kind !== 'transferencia' ? (
            <>
              {imported ? (
                <ListRow label="Categoria" value={cat.label} onPress={() => setPicking((v) => !v)} chevron />
              ) : (
                <ListRow label="Categoria" value={cat.label} />
              )}
              <Rule />
              <ListRow label={tx.kind === 'entrada' ? 'Entrou em' : 'Saiu de'} value={nameOf(byId.get(tx.accountId))} />
            </>
          ) : (
            <>
              <ListRow label="De" value={nameOf(byId.get(tx.accountId))} />
              <Rule />
              <ListRow label="Para" value={nameOf(byId.get(tx.toAccountId ?? ''))} />
            </>
          )}
          {tx.method ? (
            <>
              <Rule />
              <ListRow label="Forma" value={METHOD_LABEL[tx.method]} />
            </>
          ) : null}
          <Rule />
          <ListRow
            label="Data"
            value={`${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`}
          />
          {bill ? (
            <>
              <Rule />
              <ListRow label="Pagamento de" value={bill.title} />
            </>
          ) : null}
        </Plate>

        {imported ? (
          <View style={{ marginTop: 14, gap: 12 }}>
            <T variant="caption" tone="ink3">
              {`Veio do ${item?.name ?? 'banco'} pelo Open Finance. ${
                tx.catBy === 'pessoa'
                  ? 'Categoria escolhida por você.'
                  : tx.catBy === 'aprendida'
                    ? 'Categoria aprendida com uma correção sua.'
                    : tx.catBy === 'banco'
                      ? 'Categoria sugerida pelo banco.'
                      : 'Categoria escolhida pelo Baiu.'
              } Toque na categoria para trocar; o Baiu aprende e acerta os próximos parecidos.`}
            </T>
            {picking && tx.kind !== 'transferencia' ? (
              <CategoryGrid
                categories={tx.kind === 'entrada' ? IN_CATEGORIES : OUT_CATEGORIES}
                value={tx.category}
                onChange={(c) => {
                  dispatch({ type: 'recategorize', id: tx.id, category: c });
                  setPicking(false);
                }}
              />
            ) : null}
            {tx.review ? (
              <Button
                label="A categoria está certa"
                kind="secondary"
                icon="check"
                onPress={() => dispatch({ type: 'confirmTxs', ids: [tx.id] })}
              />
            ) : null}
          </View>
        ) : (
          <View style={{ marginTop: 20 }}>
            <Button
              label="Editar"
              kind="secondary"
              icon="edit"
              onPress={() => router.replace({ pathname: '/movimento/novo', params: { id: tx.id } })}
            />
          </View>
        )}

        <View style={styles.danger}>
          <Button label={imported ? 'Tirar do Baiu' : 'Apagar movimento'} kind="danger" icon="trash" onPress={remove} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.nightDeep },
  pad: { paddingHorizontal: gutter },
  glyph: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  glyphIn: { backgroundColor: 'rgba(94, 214, 167, 0.1)', borderColor: 'rgba(94, 214, 167, 0.28)' },
  danger: { marginTop: 56 },
});
