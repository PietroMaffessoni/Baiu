import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { AccountChips, Chips, EmptyPlate, FieldLabel, ModalHeader, TextField } from '@/components/form';
import { AmountDisplay, Keypad, useCents } from '@/components/keypad';
import { HOLDING_KINDS } from '@/data/categories';
import type { Holding, HoldingKind } from '@/data/types';
import { newId } from '@/lib/ledger';
import { brl } from '@/lib/money';
import type { HoldingOrigin } from '@/store/reducer';
import { close } from '@/lib/nav';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

type OriginType = HoldingOrigin['type'];

export default function NovoInvestimento() {
  const params = useLocalSearchParams<{ accountId?: string; id?: string }>();
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const existing = params.id ? state.holdings.find((h) => h.id === params.id) : undefined;
  const brokers = state.accounts.filter((a) => a.kind === 'investimento');
  const funders = state.accounts.filter((a) => a.kind === 'corrente' || a.kind === 'reserva');

  const [step, setStep] = useState<'detalhes' | 'valor'>('detalhes');
  const [accountId, setAccountId] = useState<string | null>(
    existing?.accountId ??
      (params.accountId && brokers.some((b) => b.id === params.accountId)
        ? params.accountId
        : (brokers[0]?.id ?? null)),
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<HoldingKind>(existing?.kind ?? 'CDB');
  const [origin, setOrigin] = useState<OriginType>('existente');
  const [fromId, setFromId] = useState<string | null>(funders[0]?.id ?? null);
  const amount = useCents(0);
  const [error, setError] = useState<string | null>(null);

  const broker = brokers.find((b) => b.id === accountId);
  const cash = broker?.balance ?? 0;

  if (brokers.length === 0) {
    return (
      <View style={styles.screen}>
        <ModalHeader left={{ label: 'Fechar', onPress: close }} />
        <View style={styles.pad}>
          <T variant="title1">Primeiro, a corretora</T>
          <View style={{ marginTop: 16 }}>
            <EmptyPlate text="Cadastre a conta de investimento onde essa aplicação está: corretora, banco ou app de investimentos.">
              <Button
                label="Adicionar corretora"
                icon="plus"
                onPress={() => router.replace({ pathname: '/nova-conta', params: { kind: 'investimento' } })}
              />
            </EmptyPlate>
          </View>
        </View>
      </View>
    );
  }

  // editar só renomeia: valores mudam pelas operações
  if (existing) {
    const saveEdit = () => {
      if (!name.trim()) return setError('Dê um nome ao investimento.');
      dispatch({ type: 'renameHolding', id: existing.id, name, kind });
      close();
    };
    return (
      <View style={styles.screen}>
        <ModalHeader
          left={{ label: 'Cancelar', onPress: close }}
          title="Editar investimento"
          right={{ label: 'Salvar', onPress: saveEdit }}
        />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          <View style={styles.pad}>
            <FieldLabel>Nome</FieldLabel>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Tesouro Selic 2029"
              accessibilityLabel="Nome"
            />
          </View>
          <View style={styles.padLeft}>
            <FieldLabel>Tipo</FieldLabel>
            <Chips
              scroll
              options={HOLDING_KINDS.map((k) => ({ value: k, label: k }))}
              value={kind}
              onChange={setKind}
            />
          </View>
          <View style={styles.pad}>
            {error ? (
              <T variant="callout" tone="vermilion" style={{ marginTop: 18 }}>
                {error}
              </T>
            ) : null}
            <View style={{ marginTop: 28 }}>
              <Button label="Salvar alterações" onPress={saveEdit} />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  const next = () => {
    if (!accountId) return setError('Escolha a corretora.');
    if (!name.trim()) return setError('Dê um nome ao investimento, como "Tesouro Selic 2029".');
    if (origin === 'conta' && !fromId) return setError('Escolha a conta de onde sai o dinheiro.');
    setError(null);
    setStep('valor');
  };

  const save = () => {
    const value = amount.cents / 100;
    if (origin === 'saldo' && value > cash + 0.001) return setError(`O saldo parado na corretora é ${brl(cash)}.`);
    const holding: Holding = {
      id: newId('h'),
      accountId: accountId!,
      name: name.trim().slice(0, 60),
      kind,
      value,
      invested: value,
      yields: [],
      createdAt: new Date().toISOString(),
    };
    const o: HoldingOrigin = origin === 'conta' ? { type: 'conta', accountId: fromId! } : { type: origin };
    dispatch({ type: 'addHolding', holding, origin: o });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    close();
  };

  if (step === 'valor') {
    return (
      <View style={styles.screen}>
        <ModalHeader left={{ label: 'Voltar', onPress: () => setStep('detalhes') }} step={{ index: 1, total: 2 }} />
        <Animated.View entering={FadeIn.duration(160)} style={{ flex: 1 }}>
          <View style={styles.pad}>
            <T variant="title1">{origin === 'existente' ? 'Quanto vale hoje?' : 'Quanto você aplicou?'}</T>
            <AmountDisplay cents={amount.cents} />
            {error ? (
              <T variant="callout" tone="vermilion" style={{ marginTop: 10 }}>
                {error}
              </T>
            ) : null}
          </View>
          <View style={{ flex: 1 }} />
          <Keypad onDigit={amount.digit} onDouble={amount.double} onBack={amount.back} />
          <View style={[styles.pad, { paddingBottom: insets.bottom + 16, paddingTop: 8 }]}>
            <Button label="Salvar investimento" disabled={amount.cents === 0} onPress={save} />
          </View>
        </Animated.View>
      </View>
    );
  }

  const origins: { value: OriginType; label: string }[] = [
    { value: 'existente', label: 'Já tinha' },
    ...(cash > 0.004 ? [{ value: 'saldo' as const, label: 'Saldo parado' }] : []),
    ...(funders.length ? [{ value: 'conta' as const, label: 'De outra conta' }] : []),
  ];

  return (
    <View style={styles.screen}>
      <ModalHeader left={{ label: 'Cancelar', onPress: close }} step={{ index: 0, total: 2 }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.pad}>
          <T variant="title1">Novo investimento</T>
        </View>
        <View style={styles.padLeft}>
          <FieldLabel>Corretora</FieldLabel>
          <AccountChips accounts={brokers} value={accountId} onChange={setAccountId} />
        </View>
        <View style={styles.pad}>
          <FieldLabel>Nome</FieldLabel>
          <TextField
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
            placeholder="Ex.: Tesouro Selic 2029"
            accessibilityLabel="Nome do investimento"
          />
        </View>
        <View style={styles.padLeft}>
          <FieldLabel>Tipo</FieldLabel>
          <Chips scroll options={HOLDING_KINDS.map((k) => ({ value: k, label: k }))} value={kind} onChange={setKind} />
        </View>
        <View style={styles.pad}>
          <FieldLabel>De onde vem o dinheiro?</FieldLabel>
          <Chips options={origins} value={origin} onChange={setOrigin} />
          <T variant="caption" tone="ink3" style={{ marginTop: 8 }}>
            {origin === 'existente'
              ? 'Para aplicações que você já tinha antes do Baiu. Não cria movimento.'
              : origin === 'saldo'
                ? `Usa o dinheiro parado na corretora (${brl(cash)}).`
                : 'Cria uma transferência para a corretora e conta como aporte.'}
          </T>
        </View>
        {origin === 'conta' && (
          <View style={styles.padLeft}>
            <FieldLabel>Sai de</FieldLabel>
            <AccountChips accounts={funders} value={fromId} onChange={setFromId} />
          </View>
        )}
        <View style={styles.pad}>
          {error ? (
            <T variant="callout" tone="vermilion" style={{ marginTop: 18 }}>
              {error}
            </T>
          ) : null}
          <View style={{ marginTop: 28 }}>
            <Button label="Continuar" onPress={next} />
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
});
