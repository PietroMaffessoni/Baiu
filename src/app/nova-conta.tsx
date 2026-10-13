import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { BankMark } from '@/components/bank-mark';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { Plate, Rule } from '@/components/layout';
import { Mark } from '@/components/mark';
import { BANKS, bankById, KIND_HINT, KIND_LABEL } from '@/data/banks';
import type { Account, AccountKind } from '@/data/types';
import { computeFolego } from '@/lib/folego';
import { brlParts } from '@/lib/money';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, font, gutter, radius } from '@/theme/tokens';

type Step = 'banco' | 'tipo' | 'valor' | 'pronto';
const ORDER: Step[] = ['banco', 'tipo', 'valor'];

const KINDS: { kind: AccountKind; icon: IconName }[] = [
  { kind: 'corrente', icon: 'bank' },
  { kind: 'reserva', icon: 'vault' },
  { kind: 'cartao', icon: 'card' },
  { kind: 'investimento', icon: 'growth' },
];

const tick = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

export default function NovaConta() {
  const { state, dispatch } = useStore();
  const folego = useFolego();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('banco');
  const [bankId, setBankId] = useState<string | null>(null);
  const [kind, setKind] = useState<AccountKind | null>(null);
  const [cents, setCents] = useState(0);
  const [nick, setNick] = useState('');
  const [due, setDue] = useState(10);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ before: number; after: number; beforeMood: string; afterMood: string } | null>(
    null,
  );

  const banks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? BANKS.filter((b) => b.name.toLowerCase().includes(q)) : BANKS;
  }, [query]);

  const back = () => {
    if (step === 'banco' || step === 'pronto') router.back();
    else setStep(ORDER[ORDER.indexOf(step) - 1]);
  };

  const add = () => {
    if (!bankId || !kind) return;
    const account: Account = {
      id: `a-${Date.now().toString(36)}`,
      bankId,
      kind,
      nickname: nick.trim() || undefined,
      balance: cents / 100,
      dueDay: kind === 'cartao' ? due : undefined,
      createdAt: new Date().toISOString(),
    };
    const after = computeFolego({ ...state, accounts: [...state.accounts, account] });
    setResult({ before: folego.score, after: after.score, beforeMood: folego.mood.label, afterMood: after.mood.label });
    dispatch({ type: 'addAccount', account });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setStep('pronto');
  };

  const restart = () => {
    setBankId(null);
    setKind(null);
    setCents(0);
    setNick('');
    setQuery('');
    setResult(null);
    setStep('banco');
  };

  const stepIndex = ORDER.indexOf(step);

  return (
    <View style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? 10 : insets.top + 6 }]}>
      <View style={styles.header}>
        {step !== 'pronto' ? (
          <Pressable onPress={back} hitSlop={10} style={styles.headerBtn} accessibilityRole="button">
            <T variant="body" tone="lantern">
              {step === 'banco' ? 'Cancelar' : 'Voltar'}
            </T>
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
        {step !== 'pronto' && (
          <View style={styles.dots} accessible accessibilityLabel={`Passo ${stepIndex + 1} de 3`}>
            {ORDER.map((s, i) => (
              <View key={s} style={[styles.dot, i <= stepIndex && styles.dotOn, i === stepIndex && styles.dotNow]} />
            ))}
          </View>
        )}
        <View style={styles.headerBtn} />
      </View>

      {step === 'banco' && (
        <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
            <View style={styles.pad}>
              <T variant="title1">Qual é o banco?</T>
              <T variant="callout" tone="ink2" style={{ marginTop: 4 }}>
                Cadastre as contas onde você recebe e paga. Uma de cada vez.
              </T>
              <View style={styles.search}>
                <Icon name="search" size={17} tint={color.ink3} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar instituição"
                  placeholderTextColor={color.ink3}
                  selectionColor={color.lantern}
                  keyboardAppearance="dark"
                  autoCorrect={false}
                  style={styles.searchInput}
                  accessibilityLabel="Buscar instituição"
                />
              </View>
            </View>
            <View style={styles.pad}>
              <Plate style={{ paddingHorizontal: 14 }}>
                {banks.map((b, i) => (
                  <View key={b.id}>
                    {i > 0 && <Rule inset={54} />}
                    <Pressable
                      onPress={() => {
                        tick();
                        setBankId(b.id);
                        setStep('tipo');
                      }}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                      accessibilityRole="button">
                      <BankMark bankId={b.id} size={40} />
                      <T variant="bodyStrong" style={{ flex: 1 }}>
                        {b.name}
                      </T>
                      <Icon name="chevron" size={14} tint={color.ink3} weight="semibold" />
                    </Pressable>
                  </View>
                ))}
                {banks.length === 0 && (
                  <T variant="callout" tone="ink3" style={{ paddingVertical: 16 }}>
                    Nenhuma instituição com esse nome. Escolha “Outra instituição”.
                  </T>
                )}
              </Plate>
              <View style={styles.soon}>
                <Icon name="lock" size={15} tint={color.ink3} />
                <T variant="caption" tone="ink3" style={{ flex: 1 }}>
                  Conectar direto com o banco, pelo Open Finance, chega numa próxima versão. Por enquanto o cadastro é
                  manual e fica só neste aparelho.
                </T>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {step === 'tipo' && bankId && (
        <Animated.View entering={FadeIn.duration(180)} style={[styles.pad, { flex: 1 }]}>
          <View style={styles.bankLine}>
            <BankMark bankId={bankId} size={28} />
            <T variant="calloutStrong" tone="ink2">
              {bankById(bankId).name}
            </T>
          </View>
          <T variant="title1">Que tipo de conta é?</T>
          <Plate style={{ paddingHorizontal: 14, marginTop: 20 }}>
            {KINDS.map((k, i) => (
              <View key={k.kind}>
                {i > 0 && <Rule inset={54} />}
                <Pressable
                  onPress={() => {
                    tick();
                    setKind(k.kind);
                    setTimeout(() => setStep('valor'), 160);
                  }}
                  style={({ pressed }) => [styles.row, { minHeight: 72 }, pressed && styles.rowPressed]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: kind === k.kind }}>
                  <View style={styles.kindGlyph}>
                    <Icon name={k.icon} size={19} tint={color.lantern} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">{KIND_LABEL[k.kind]}</T>
                    <T variant="caption" tone="ink3">
                      {KIND_HINT[k.kind]}
                    </T>
                  </View>
                  <Mark state={kind === k.kind ? 'cheia' : 'vazia'} />
                </Pressable>
              </View>
            ))}
          </Plate>
        </Animated.View>
      )}

      {step === 'valor' && bankId && kind && (
        <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.pad}>
              <View style={styles.bankLine}>
                <BankMark bankId={bankId} size={28} />
                <T variant="calloutStrong" tone="ink2">
                  {bankById(bankId).name} · {KIND_LABEL[kind]}
                </T>
              </View>
              <T variant="title1">{kind === 'cartao' ? 'Qual o valor da fatura atual?' : 'Quanto tem nela hoje?'}</T>
              <Amount cents={cents} />
              <TextInput
                value={nick}
                onChangeText={setNick}
                placeholder="Apelido, se quiser. Ex.: Reserva da viagem"
                placeholderTextColor={color.ink3}
                selectionColor={color.lantern}
                keyboardAppearance="dark"
                maxLength={32}
                style={styles.nick}
                accessibilityLabel="Apelido da conta, opcional"
              />
              {kind === 'cartao' && (
                <View style={{ marginTop: 14 }}>
                  <T variant="caption" tone="ink2" style={{ marginBottom: 8 }}>
                    Dia do vencimento
                  </T>
                  <View style={styles.chips}>
                    {[5, 10, 15, 20, 25].map((d) => (
                      <Pressable
                        key={d}
                        onPress={() => {
                          tick();
                          setDue(d);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: due === d }}
                        style={[styles.chip, due === d && styles.chipOn]}>
                        <T variant="calloutStrong" tabular style={{ color: due === d ? color.night : color.paper }}>
                          {d}
                        </T>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }} />
            <Keypad
              onDigit={(d) => setCents((c) => (c >= 1e10 ? c : c * 10 + d))}
              onDouble={() => setCents((c) => (c >= 1e9 ? c : c * 100))}
              onBack={() => setCents((c) => Math.floor(c / 10))}
            />
            <View style={[styles.pad, { paddingBottom: insets.bottom + 16, paddingTop: 8 }]}>
              <Button label="Adicionar conta" onPress={add} />
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {step === 'pronto' && result && (
        <Animated.View
          entering={FadeIn.duration(240)}
          style={[styles.pad, styles.done, { paddingBottom: insets.bottom + 16 }]}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Baiu score={result.after} width={170} interactive />
            <Animated.View
              entering={FadeInDown.delay(250).duration(320)}
              style={{ alignItems: 'center', marginTop: 18 }}>
              <T variant="hero" align="center">
                Conta adicionada
              </T>
              <T variant="body" tone="ink2" align="center" style={{ marginTop: 6, maxWidth: 300 }}>
                {result.afterMood !== result.beforeMood
                  ? `O Baiu ficou ${result.afterMood.toLowerCase()}. Segure ele para ver.`
                  : result.after > result.before
                    ? 'O Baiu ganhou fôlego com essa conta.'
                    : 'Tudo registrado. O Baiu acompanha essa conta a partir de agora.'}
              </T>
              <View style={styles.delta}>
                <T variant="calloutStrong" tone="ink2" tabular>
                  Fôlego {result.before}
                </T>
                <Icon name="chevron" size={12} tint={color.ink3} weight="semibold" />
                <T variant="calloutStrong" tone={result.after > result.before ? 'lantern' : 'paper'} tabular>
                  {result.after}
                </T>
              </View>
            </Animated.View>
          </View>
          <View style={{ gap: 6 }}>
            <Button label="Concluir" onPress={() => router.back()} />
            <Button label="Adicionar outra conta" kind="quiet" onPress={restart} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function Amount({ cents }: { cents: number }) {
  const p = brlParts(cents / 100);
  const empty = cents === 0;
  return (
    <View style={styles.amount} accessible accessibilityLabel={`${p.int} reais e ${p.cents} centavos`}>
      <Text allowFontScaling={false} style={[styles.amountSmall, { color: color.ink2 }]}>
        R$
      </Text>
      <Text allowFontScaling={false} style={[styles.amountInt, empty && { color: color.ink3 }]}>
        {p.int}
      </Text>
      <Text allowFontScaling={false} style={[styles.amountSmall, { color: empty ? color.ink3 : color.ink2 }]}>
        ,{p.cents}
      </Text>
    </View>
  );
}

function Keypad({
  onDigit,
  onDouble,
  onBack,
}: {
  onDigit: (d: number) => void;
  onDouble: () => void;
  onBack: () => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'];
  return (
    <View style={styles.keypad}>
      {keys.map((k) => (
        <Pressable
          key={k}
          onPress={() => {
            tick();
            if (k === 'back') onBack();
            else if (k === '00') onDouble();
            else onDigit(Number(k));
          }}
          style={({ pressed }) => [styles.key, pressed && { backgroundColor: color.plate }]}
          accessibilityRole="button"
          accessibilityLabel={k === 'back' ? 'Apagar' : k}>
          {k === 'back' ? (
            <Icon name="backspace" size={22} tint={color.ink2} />
          ) : (
            <Text allowFontScaling={false} style={styles.keyText}>
              {k}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter - 4,
    minHeight: 48,
    marginBottom: 8,
  },
  headerBtn: { minWidth: 72, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: color.plateHi },
  dotOn: { backgroundColor: 'rgba(255, 182, 72, 0.45)' },
  dotNow: { backgroundColor: color.lantern, width: 28 },
  pad: { paddingHorizontal: gutter },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  searchInput: { flex: 1, color: color.paper, fontSize: 16, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, paddingVertical: 10 },
  rowPressed: { opacity: 0.6 },
  soon: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'flex-start' },
  bankLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  kindGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lanternWash,
  },
  amount: { flexDirection: 'row', alignItems: 'baseline', marginTop: 22 },
  amountSmall: { fontFamily: font.bold, fontSize: 22, marginRight: 4 },
  amountInt: { fontFamily: font.black, fontSize: 52, lineHeight: 64, color: color.paper, letterSpacing: -1 },
  nick: {
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    color: color.paper,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    width: 48,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  chipOn: { backgroundColor: color.lantern, borderColor: color.lantern },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: gutter - 6, marginTop: 16 },
  key: { width: '33.333%', height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  keyText: { fontFamily: font.bold, fontSize: 26, color: color.paper },
  done: { flex: 1 },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
});
