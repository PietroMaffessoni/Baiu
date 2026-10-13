import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { AccountChips, CategoryGrid, DateField, FieldLabel, ModalHeader, TextField } from '@/components/form';
import { AmountDisplay, Keypad, useCents } from '@/components/keypad';
import { withoutCurtain } from '@/components/lock-gate';
import { OUT_CATEGORIES } from '@/data/categories';
import type { Bill, OutCategory } from '@/data/types';
import { addDays, startOfDay } from '@/lib/dates';
import { newId } from '@/lib/ledger';
import { remindersAllowed } from '@/lib/reminders';
import { close } from '@/lib/nav';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

export default function NovoVencimento() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const existing = id ? state.bills.find((b) => b.id === id) : undefined;
  const editing = !!existing;

  const [step, setStep] = useState<'valor' | 'detalhes'>(editing ? 'detalhes' : 'valor');
  const amount = useCents(existing ? Math.round(existing.amount * 100) : 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<OutCategory | null>(existing?.category ?? null);
  const [accountId, setAccountId] = useState<string>(existing?.accountId ?? 'depois');
  const [repeat, setRepeat] = useState(existing?.repeatMonthly ?? true);
  const [due, setDue] = useState(() => {
    const d = existing ? new Date(existing.dueDate) : addDays(startOfDay(new Date()), 7);
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [error, setError] = useState<string | null>(null);

  const payers = state.accounts.filter((a) => a.kind !== 'investimento');

  const save = async () => {
    if (!title.trim()) return setError('Dê um nome ao vencimento, como "Aluguel" ou "Internet".');
    if (amount.cents === 0) return setError('Informe o valor.');
    const bill: Bill = {
      id: existing?.id ?? newId('b'),
      title: title.trim().slice(0, 60),
      amount: amount.cents / 100,
      dueDate: due.toISOString(),
      category: category ?? 'contas',
      accountId: accountId === 'depois' ? undefined : accountId,
      repeatMonthly: repeat,
      paid: existing?.paid ?? false,
      paidAt: existing?.paidAt,
      paidTxId: existing?.paidTxId,
      fromBillId: existing?.fromBillId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    dispatch(editing ? { type: 'updateBill', bill } : { type: 'addBill', bill });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // o pedido de permissão aparece na hora em que faz sentido: ao criar o primeiro lembrete
    if (!editing && state.settings.reminders) await withoutCurtain(() => remindersAllowed(true)).catch(() => false);
    close();
  };

  if (step === 'valor') {
    return (
      <View style={styles.screen}>
        <ModalHeader
          left={{ label: 'Cancelar', onPress: () => (editing ? setStep('detalhes') : close()) }}
          step={editing ? undefined : { index: 0, total: 2 }}
          title={editing ? 'Valor' : undefined}
        />
        <Animated.View entering={FadeIn.duration(160)} style={{ flex: 1 }}>
          <View style={styles.pad}>
            <T variant="title1">Quanto vai pagar?</T>
            <AmountDisplay cents={amount.cents} />
          </View>
          <View style={{ flex: 1 }} />
          <Keypad onDigit={amount.digit} onDouble={amount.double} onBack={amount.back} />
          <View style={[styles.pad, { paddingBottom: insets.bottom + 16, paddingTop: 8 }]}>
            <Button label="Continuar" disabled={amount.cents === 0} onPress={() => setStep('detalhes')} />
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModalHeader
        left={
          editing ? { label: 'Cancelar', onPress: () => close() } : { label: 'Voltar', onPress: () => setStep('valor') }
        }
        step={editing ? undefined : { index: 1, total: 2 }}
        title={editing ? 'Editar vencimento' : undefined}
        right={{ label: 'Salvar', onPress: save }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.pad}>
          <Pressable
            onPress={() => setStep('valor')}
            style={styles.amountRow}
            accessibilityRole="button"
            accessibilityHint="Alterar o valor">
            <View style={{ flex: 1, marginTop: -18 }}>
              <AmountDisplay cents={amount.cents} size={34} />
            </View>
            <T variant="calloutStrong" tone="lantern">
              Alterar
            </T>
          </Pressable>

          <FieldLabel>Nome</FieldLabel>
          <TextField
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              setError(null);
            }}
            placeholder="Ex.: Aluguel, Internet, IPVA"
            accessibilityLabel="Nome do vencimento"
          />

          <FieldLabel>Vence em</FieldLabel>
          <DateField value={due} onChange={setDue} future />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <T variant="body">Repete todo mês</T>
              <T variant="caption" tone="ink3">
                Ao pagar, o Baiu já cria o do mês seguinte.
              </T>
            </View>
            <Switch
              value={repeat}
              onValueChange={setRepeat}
              trackColor={{ true: color.lantern, false: color.plateHi }}
              thumbColor={Platform.OS === 'android' ? color.paper : undefined}
              ios_backgroundColor={color.plateHi}
              accessibilityLabel="Repete todo mês"
            />
          </View>

          <FieldLabel>Categoria</FieldLabel>
          <CategoryGrid categories={OUT_CATEGORIES} value={category} onChange={(c) => setCategory(c as OutCategory)} />
        </View>

        <View style={styles.padLeft}>
          <FieldLabel>Pagar com</FieldLabel>
          <AccountChips
            accounts={payers}
            value={accountId}
            onChange={setAccountId}
            extra={{ id: 'depois', label: 'Escolher na hora' }}
          />
        </View>

        <View style={styles.pad}>
          {error ? (
            <T variant="callout" tone="vermilion" style={{ marginTop: 18 }} accessibilityLiveRegion="polite">
              {error}
            </T>
          ) : null}
          <View style={{ marginTop: 28 }}>
            <Button label={editing ? 'Salvar alterações' : 'Salvar vencimento'} onPress={save} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: gutter },
  padLeft: { paddingLeft: gutter },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
});
