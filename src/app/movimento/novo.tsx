import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import {
  AccountChips,
  CategoryGrid,
  Chips,
  DateField,
  EmptyPlate,
  FieldLabel,
  ModalHeader,
  Segmented,
  TextField,
} from '@/components/form';
import { AmountDisplay, Keypad, useCents } from '@/components/keypad';
import { CATEGORY, IN_CATEGORIES, METHOD_LABEL, METHODS, OUT_CATEGORIES } from '@/data/categories';
import type { Category, Method, Tx, TxKind } from '@/data/types';
import { newId, validateTx } from '@/lib/ledger';
import { close } from '@/lib/nav';
import { useAccountsById, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

type Params = { id?: string; kind?: string; accountId?: string; toAccountId?: string; cents?: string };

const KINDS: { value: TxKind; label: string }[] = [
  { value: 'saida', label: 'Saída' },
  { value: 'entrada', label: 'Entrada' },
  { value: 'transferencia', label: 'Transferência' },
];

const QUESTION: Record<TxKind, string> = {
  saida: 'Quanto saiu?',
  entrada: 'Quanto entrou?',
  transferencia: 'Quanto vai transferir?',
};

const PLACEHOLDER: Record<TxKind, string> = {
  saida: 'Ex.: Mercado do mês',
  entrada: 'Ex.: Salário de outubro',
  transferencia: 'Ex.: Para a reserva',
};

export default function NovoMovimento() {
  const params = useLocalSearchParams<Params>();
  const { state, dispatch } = useStore();
  const byId = useAccountsById();
  const insets = useSafeAreaInsets();
  const existing = params.id ? state.txs.find((t) => t.id === params.id) : undefined;
  const editing = !!existing;

  const initialKind: TxKind =
    existing?.kind ?? (KINDS.some((k) => k.value === params.kind) ? (params.kind as TxKind) : 'saida');
  // contas conectadas se atualizam sozinhas: registrar nelas à mão duplicaria o movimento
  const manual = useMemo(() => state.accounts.filter((a) => !a.link), [state.accounts]);
  const firstNonCard = manual.find((a) => a.kind === 'corrente') ?? manual.find((a) => a.kind !== 'cartao');

  const [step, setStep] = useState<'valor' | 'detalhes'>(editing ? 'detalhes' : 'valor');
  const [kind, setKind] = useState<TxKind>(initialKind);
  const amount = useCents(existing ? Math.round(existing.amount * 100) : Number(params.cents) || 0);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState<Category | null>(
    existing && existing.kind !== 'transferencia' ? existing.category : null,
  );
  const [accountId, setAccountId] = useState<string | null>(
    existing?.accountId ??
      (params.accountId && manual.some((a) => a.id === params.accountId) ? params.accountId : null) ??
      (initialKind === 'transferencia' ? firstNonCard?.id : manual[0]?.id) ??
      null,
  );
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.toAccountId ?? params.toAccountId ?? null);
  const [method, setMethod] = useState<Method | null>(
    existing?.method && existing.method !== 'cartao' ? existing.method : null,
  );
  const [date, setDate] = useState(() => {
    return existing ? new Date(existing.date) : new Date();
  });
  const [error, setError] = useState<string | null>(null);

  const source = accountId ? byId.get(accountId) : undefined;
  const sources = useMemo(
    () => (kind === 'transferencia' ? manual.filter((a) => a.kind !== 'cartao') : manual),
    [kind, manual],
  );
  const targets = useMemo(() => manual.filter((a) => a.id !== accountId), [manual, accountId]);

  const changeKind = (k: TxKind) => {
    setKind(k);
    setError(null);
    setCategory(null);
    if (k === 'transferencia' && source?.kind === 'cartao') setAccountId(firstNonCard?.id ?? null);
  };

  const save = () => {
    if (!accountId) return setError('Escolha uma conta.');
    const fallback: Category = kind === 'saida' ? 'outros' : kind === 'entrada' ? 'outras_entradas' : 'transferencia';
    const cat = kind === 'transferencia' ? 'transferencia' : (category ?? fallback);
    const tx: Tx = {
      id: existing?.id ?? newId('t'),
      kind,
      accountId,
      toAccountId: kind === 'transferencia' ? (toAccountId ?? undefined) : undefined,
      amount: amount.cents / 100,
      description: (description.trim() || (kind === 'transferencia' ? 'Transferência' : CATEGORY[cat].label)).slice(
        0,
        80,
      ),
      category: cat,
      method: source?.kind === 'cartao' && kind === 'saida' ? 'cartao' : (method ?? undefined),
      date: date.toISOString(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const problem = validateTx(tx, byId);
    if (problem) return setError(problem);
    dispatch(editing ? { type: 'updateTx', tx } : { type: 'addTx', tx });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    close();
  };

  if (manual.length === 0 && !existing) {
    const linked = state.accounts.length > 0;
    return (
      <View style={styles.screen}>
        <ModalHeader left={{ label: 'Fechar', onPress: () => close() }} />
        <View style={styles.pad}>
          <T variant="title1">{linked ? 'Suas contas se atualizam sozinhas' : 'Primeiro, uma conta'}</T>
          <View style={{ marginTop: 16 }}>
            <EmptyPlate
              text={
                linked
                  ? 'Tudo o que entra e sai das contas conectadas aparece no Baiu sem você digitar. Para registrar à mão, como dinheiro vivo, cadastre uma conta manual.'
                  : 'Para registrar entradas e gastos, conecte seu banco ou cadastre a conta de onde o dinheiro sai ou onde ele entra.'
              }>
              <Button label="Adicionar conta" icon="plus" onPress={() => router.replace('/nova-conta')} />
            </EmptyPlate>
          </View>
        </View>
      </View>
    );
  }

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
            <Segmented options={KINDS} value={kind} onChange={changeKind} />
            <T variant="title1" style={{ marginTop: 22 }}>
              {QUESTION[kind]}
            </T>
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
        title={editing ? 'Editar movimento' : undefined}
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
            <View style={{ flex: 1 }}>
              <T variant="captionStrong" tone="ink2">
                {KINDS.find((k) => k.value === kind)?.label}
              </T>
              <View style={{ marginTop: -18 }}>
                <AmountDisplay cents={amount.cents} size={34} negative={kind === 'saida'} />
              </View>
            </View>
            <T variant="calloutStrong" tone="lantern">
              Alterar
            </T>
          </Pressable>

          <FieldLabel>Descrição</FieldLabel>
          <TextField
            value={description}
            onChangeText={setDescription}
            placeholder={PLACEHOLDER[kind]}
            maxLength={80}
            accessibilityLabel="Descrição"
          />

          {kind !== 'transferencia' && (
            <>
              <FieldLabel>Categoria</FieldLabel>
              <CategoryGrid
                categories={kind === 'saida' ? OUT_CATEGORIES : IN_CATEGORIES}
                value={category}
                onChange={setCategory}
              />
            </>
          )}
        </View>

        <View style={styles.padLeft}>
          <FieldLabel>
            {kind === 'entrada' ? 'Em qual conta entrou?' : kind === 'saida' ? 'De qual conta saiu?' : 'De qual conta?'}
          </FieldLabel>
          <AccountChips
            accounts={sources}
            value={accountId}
            onChange={(id) => {
              setAccountId(id);
              if (id === toAccountId) setToAccountId(null);
              setError(null);
            }}
          />
          {kind === 'transferencia' && (
            <>
              <FieldLabel>Para qual conta?</FieldLabel>
              <AccountChips
                accounts={targets}
                value={toAccountId}
                onChange={(id) => {
                  setToAccountId(id);
                  setError(null);
                }}
              />
              {toAccountId && byId.get(toAccountId)?.kind === 'cartao' ? (
                <T variant="caption" tone="ink3" style={{ marginTop: 8, marginRight: gutter }}>
                  Transferir para o cartão paga a fatura.
                </T>
              ) : toAccountId && byId.get(toAccountId)?.kind === 'investimento' ? (
                <T variant="caption" tone="ink3" style={{ marginTop: 8, marginRight: gutter }}>
                  Conta como aporte na constância do Baiu.
                </T>
              ) : null}
            </>
          )}
          {kind !== 'transferencia' && source?.kind !== 'cartao' && (
            <>
              <FieldLabel>Forma</FieldLabel>
              <Chips
                scroll
                options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
                value={method}
                onChange={setMethod}
              />
            </>
          )}
        </View>

        <View style={styles.pad}>
          <FieldLabel>Data</FieldLabel>
          <DateField value={date} onChange={setDate} />

          {error ? (
            <T variant="callout" tone="vermilion" style={{ marginTop: 18 }} accessibilityLiveRegion="polite">
              {error}
            </T>
          ) : null}

          <View style={{ marginTop: 28 }}>
            <Button label={editing ? 'Salvar alterações' : 'Salvar movimento'} onPress={save} />
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
});
