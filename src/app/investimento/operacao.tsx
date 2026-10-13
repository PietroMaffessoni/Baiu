import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { AccountChips, FieldLabel, ModalHeader } from '@/components/form';
import { AmountDisplay, Keypad, useCents } from '@/components/keypad';
import { brl } from '@/lib/money';
import type { HoldingOrigin } from '@/store/reducer';
import { close } from '@/lib/nav';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

type Op = 'valor' | 'aplicar' | 'resgatar';

const TITLE: Record<Op, string> = {
  valor: 'Quanto vale hoje?',
  aplicar: 'Quanto vai aplicar?',
  resgatar: 'Quanto vai resgatar?',
};

export default function OperacaoInvestimento() {
  const { id, op: rawOp } = useLocalSearchParams<{ id: string; op: string }>();
  const op: Op = rawOp === 'aplicar' || rawOp === 'resgatar' ? rawOp : 'valor';
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const h = state.holdings.find((x) => x.id === id);
  const broker = state.accounts.find((a) => a.id === h?.accountId);
  const others = state.accounts.filter((a) => a.kind === 'corrente' || a.kind === 'reserva');
  const amount = useCents(op === 'valor' && h ? Math.round(h.value * 100) : 0);
  const cash = broker?.balance ?? 0;
  const [source, setSource] = useState<string>(cash > 0.004 ? 'saldo' : (others[0]?.id ?? 'saldo'));
  const [target, setTarget] = useState<string>('corretora');
  const [error, setError] = useState<string | null>(null);

  if (!h) {
    return (
      <View style={styles.screen}>
        <ModalHeader left={{ label: 'Fechar', onPress: () => close() }} />
      </View>
    );
  }

  const save = () => {
    const v = amount.cents / 100;
    const date = new Date().toISOString();
    if (op === 'valor') {
      dispatch({ type: 'holdingValue', id: h.id, value: v, date });
    } else if (op === 'aplicar') {
      if (v <= 0) return;
      if (source === 'saldo' && v > cash + 0.001) return setError(`O saldo parado na corretora é ${brl(cash)}.`);
      const origin: HoldingOrigin = source === 'saldo' ? { type: 'saldo' } : { type: 'conta', accountId: source };
      dispatch({ type: 'holdingApply', id: h.id, amount: v, origin, date });
    } else {
      if (v <= 0) return;
      if (v > h.value + 0.001) return setError(`O investimento vale ${brl(h.value)}.`);
      dispatch({
        type: 'holdingRedeem',
        id: h.id,
        amount: v,
        toAccountId: target === 'corretora' ? undefined : target,
        date,
      });
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    close();
  };

  return (
    <View style={styles.screen}>
      <ModalHeader left={{ label: 'Cancelar', onPress: () => close() }} title={h.name} />
      <View style={styles.pad}>
        <T variant="title1">{TITLE[op]}</T>
        <AmountDisplay cents={amount.cents} />
        {op === 'valor' && (
          <T variant="caption" tone="ink3" style={{ marginTop: 6 }}>
            Valor anterior: {brl(h.value)}. A diferença entra como variação do mês.
          </T>
        )}
      </View>
      {op === 'aplicar' && (
        <View style={styles.padLeft}>
          <FieldLabel>De onde vem</FieldLabel>
          <AccountChips
            accounts={others}
            value={source}
            onChange={(s) => {
              setSource(s);
              setError(null);
            }}
            extra={cash > 0.004 ? { id: 'saldo', label: `Saldo parado (${brl(cash, { cents: false })})` } : undefined}
          />
        </View>
      )}
      {op === 'resgatar' && (
        <View style={styles.padLeft}>
          <FieldLabel>Para onde vai</FieldLabel>
          <AccountChips
            accounts={others}
            value={target}
            onChange={setTarget}
            extra={{ id: 'corretora', label: 'Fica na corretora' }}
          />
        </View>
      )}
      {error ? (
        <View style={styles.pad}>
          <T variant="callout" tone="vermilion" style={{ marginTop: 12 }}>
            {error}
          </T>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      <Keypad
        onDigit={(d) => {
          setError(null);
          amount.digit(d);
        }}
        onDouble={amount.double}
        onBack={amount.back}
      />
      <View style={[styles.pad, { paddingBottom: insets.bottom + 16, paddingTop: 8 }]}>
        <Button label="Salvar" disabled={op !== 'valor' && amount.cents === 0} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: gutter },
  padLeft: { paddingLeft: gutter },
});
