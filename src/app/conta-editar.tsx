import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankMark } from '@/components/bank-mark';
import { Button } from '@/components/button';
import { Chips, FieldLabel, ModalHeader, TextField } from '@/components/form';
import { AmountDisplay, Keypad, useCents } from '@/components/keypad';
import { bankById, KIND_LABEL } from '@/data/banks';
import { close } from '@/lib/nav';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function EditarConta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const account = state.accounts.find((a) => a.id === id);

  const [mode, setMode] = useState<'form' | 'saldo'>('form');
  const [nickname, setNickname] = useState(account?.nickname ?? '');
  const balance = useCents(account ? Math.round(Math.abs(account.balance) * 100) : 0);
  const [negative, setNegative] = useState((account?.balance ?? 0) < 0);
  const [dueDay, setDueDay] = useState(account?.dueDay ?? 10);
  const [limit, setLimit] = useState(account?.limit ? String(Math.round(account.limit)) : '');

  if (!account) {
    return (
      <View style={styles.screen}>
        <ModalHeader left={{ label: 'Fechar', onPress: () => close() }} />
      </View>
    );
  }

  const card = account.kind === 'cartao';
  const label = card ? 'Fatura atual' : account.kind === 'investimento' ? 'Saldo parado na corretora' : 'Saldo atual';

  const save = () => {
    const parsedLimit = Number(limit.replace(/\D/g, ''));
    dispatch({
      type: 'updateAccount',
      id: account.id,
      patch: {
        nickname: nickname.trim().slice(0, 32) || undefined,
        balance: ((negative && !card ? -1 : 1) * balance.cents) / 100,
        dueDay: card ? dueDay : undefined,
        limit: card && parsedLimit > 0 ? parsedLimit : undefined,
      },
    });
    close();
  };

  if (mode === 'saldo') {
    return (
      <View style={styles.screen}>
        <ModalHeader left={{ label: 'Voltar', onPress: () => setMode('form') }} title={label} />
        <View style={styles.pad}>
          <AmountDisplay cents={balance.cents} negative={negative && !card} />
          <T variant="caption" tone="ink3" style={{ marginTop: 8 }}>
            Ajustar o saldo não cria movimento no extrato. Use quando o valor do banco e o do Baiu não baterem.
          </T>
        </View>
        <View style={{ flex: 1 }} />
        <Keypad onDigit={balance.digit} onDouble={balance.double} onBack={balance.back} />
        <View style={[styles.pad, { paddingBottom: insets.bottom + 16, paddingTop: 8 }]}>
          <Button label="Pronto" onPress={() => setMode('form')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModalHeader
        left={{ label: 'Cancelar', onPress: () => close() }}
        title="Editar conta"
        right={{ label: 'Salvar', onPress: save }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.pad}>
          <View style={styles.bankLine}>
            <BankMark bankId={account.bankId} size={28} />
            <T variant="calloutStrong" tone="ink2">
              {bankById(account.bankId).name} · {KIND_LABEL[account.kind]}
            </T>
          </View>

          <FieldLabel>Apelido</FieldLabel>
          <TextField
            value={nickname}
            onChangeText={setNickname}
            placeholder="Ex.: Conta do salário"
            maxLength={32}
            accessibilityLabel="Apelido"
          />

          <FieldLabel>{label}</FieldLabel>
          <Pressable
            onPress={() => setMode('saldo')}
            style={styles.amountRow}
            accessibilityRole="button"
            accessibilityHint="Alterar o valor">
            <View style={{ flex: 1, marginTop: -18 }}>
              <AmountDisplay cents={balance.cents} size={34} negative={negative && !card} />
            </View>
            <T variant="calloutStrong" tone="lantern">
              Alterar
            </T>
          </Pressable>

          {!card && account.kind === 'corrente' && (
            <View style={styles.switchRow}>
              <T variant="body" style={{ flex: 1 }}>
                Conta no negativo
              </T>
              <Switch
                value={negative}
                onValueChange={setNegative}
                trackColor={{ true: color.vermilion, false: color.plateHi }}
                thumbColor={Platform.OS === 'android' ? color.paper : undefined}
                ios_backgroundColor={color.plateHi}
                accessibilityLabel="Conta no negativo"
              />
            </View>
          )}
        </View>

        {card && (
          <>
            <View style={styles.padLeft}>
              <FieldLabel>Dia do vencimento</FieldLabel>
              <Chips
                scroll
                options={DAYS.map((d) => ({ value: d, label: String(d) }))}
                value={dueDay}
                onChange={setDueDay}
              />
            </View>
            <View style={styles.pad}>
              <FieldLabel>Limite do cartão (opcional)</FieldLabel>
              <TextField
                value={limit}
                onChangeText={(t) => setLimit(t.replace(/\D/g, '').slice(0, 9))}
                placeholder="Ex.: 5000"
                keyboardType="number-pad"
                accessibilityLabel="Limite do cartão em reais"
              />
            </View>
          </>
        )}

        <View style={[styles.pad, { marginTop: 28 }]}>
          <Button label="Salvar alterações" onPress={save} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: gutter },
  padLeft: { paddingLeft: gutter },
  bankLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
});
