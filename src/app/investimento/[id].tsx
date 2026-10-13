import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ListRow } from '@/components/form';
import { Plate, Rule } from '@/components/layout';
import { BigMoney } from '@/components/money';
import { bankById } from '@/data/banks';
import { brl, HIDDEN, pct } from '@/lib/money';
import { monthPeriod } from '@/lib/summary';
import { close } from '@/lib/nav';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

export default function InvestimentoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const h = state.holdings.find((x) => x.id === id);

  if (!h) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <T variant="body" tone="ink2">
          Este investimento foi removido.
        </T>
      </View>
    );
  }

  const broker = state.accounts.find((a) => a.id === h.accountId);
  const result = h.value - h.invested;
  const p = monthPeriod(0);
  const month = h.yields
    .filter((y) => new Date(y.date) >= p.start && new Date(y.date) < p.end)
    .reduce((n, y) => n + y.amount, 0);
  const hide = state.settings.hideValues;
  const money = (v: number, sign = false) => (hide ? HIDDEN : brl(v, { sign: sign ? 'always' : 'auto' }));
  const op = (o: 'valor' | 'aplicar' | 'resgatar') =>
    router.replace({ pathname: '/investimento/operacao', params: { id: h.id, op: o } });

  const remove = () => {
    const go = () => {
      dispatch({ type: 'removeHolding', id: h.id });
      close();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert(
      'Remover este investimento?',
      'O valor dele sai do seu patrimônio no Baiu. Para trazer o dinheiro de volta a uma conta, use Resgatar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: go },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: 28, paddingBottom: insets.bottom + 40 }}>
      <View style={styles.pad}>
        <View style={styles.kind}>
          <T variant="micro" tone="ink2">
            {h.kind}
          </T>
        </View>
        <T variant="title2" style={{ marginTop: 10 }}>
          {h.name}
        </T>
        <T variant="callout" tone="ink2">
          {broker ? (broker.nickname ?? bankById(broker.bankId).name) : ''}
        </T>
        <View style={{ marginTop: -6 }}>
          <BigMoney value={h.value} size={38} />
        </View>

        <Plate style={{ paddingHorizontal: 14, marginTop: 18 }}>
          <ListRow label="Aplicado" value={money(h.invested)} />
          <Rule />
          <ListRow
            label="Resultado"
            value={
              h.invested > 0
                ? `${money(result, true)} (${result >= 0 ? '+' : '−'}${pct(Math.abs(result) / h.invested, 2)})`
                : money(result, true)
            }
          />
          <Rule />
          <ListRow label="Variação este mês" value={money(month, true)} />
        </Plate>

        <View style={{ marginTop: 20, gap: 10 }}>
          <Button label="Atualizar valor" onPress={() => op('valor')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Aplicar mais" kind="secondary" onPress={() => op('aplicar')} style={{ flex: 1 }} />
            <Button label="Resgatar" kind="secondary" onPress={() => op('resgatar')} style={{ flex: 1 }} />
          </View>
          <Button
            label="Editar nome e tipo"
            kind="quiet"
            icon="edit"
            onPress={() => router.replace({ pathname: '/investimento/novo', params: { id: h.id } })}
          />
        </View>
        <T variant="caption" tone="ink3" style={{ marginTop: 8 }}>
          Atualize o valor sempre que olhar o app da corretora. A diferença vira o rendimento do mês.
        </T>

        <View style={{ marginTop: 48 }}>
          <Button label="Remover investimento" kind="danger" icon="trash" onPress={remove} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.nightDeep },
  pad: { paddingHorizontal: gutter },
  kind: {
    alignSelf: 'flex-start',
    minWidth: 54,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
    alignItems: 'center',
  },
});
