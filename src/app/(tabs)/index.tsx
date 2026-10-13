import { Link, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu, levelScale } from '@/components/baiu/baiu';
import { PALETTE, VB_W } from '@/components/baiu/geometry';
import { BankMark } from '@/components/bank-mark';
import { IconButton } from '@/components/button';
import { DayBars } from '@/components/day-bars';
import { GroundLight } from '@/components/ground-light';
import { Icon } from '@/components/icon';
import { DemoNote, Plate, Rule, Section } from '@/components/layout';
import { Mark } from '@/components/mark';
import { BigMoney, Money } from '@/components/money';
import { Seal } from '@/components/seal';
import { TxRow } from '@/components/tx-row';
import { bankById, KIND_LABEL } from '@/data/banks';
import type { Account } from '@/data/types';
import { greeting, longToday } from '@/lib/dates';
import { brl, HIDDEN } from '@/lib/money';
import { sealsFor } from '@/lib/seals';
import { dailySpending, sortedTxs } from '@/lib/summary';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

export default function Home() {
  const { state, dispatch } = useStore();
  const folego = useFolego();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const s = folego.summary;
  const bars = useMemo(() => dailySpending(state), [state]);
  const recent = useMemo(() => sortedTxs(state).slice(0, 4), [state]);
  const seals = useMemo(
    () =>
      sealsFor(state, folego)
        .filter((x) => x.earned)
        .slice(-3)
        .reverse(),
    [state, folego],
  );
  const accountsById = useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts]);

  const lanternW = Math.min(200, Math.round(width * 0.5));
  const cord = insets.top + 26;
  const lanternH = (lanternW * 240) / VB_W;
  const stage = cord + lanternH * 0.94;
  const glow = PALETTE[folego.mood.mood].glow;
  const hide = state.hideValues;

  const fatura = state.accounts.find((a) => a.kind === 'cartao');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never">
      <GroundLight
        width={width}
        height={stage + 260}
        cx={width / 2}
        cy={cord + lanternH * 0.42 * levelScale(folego.score)}
        intensity={0.35 + glow * 0.65}
      />

      {/* palco: a lanterna pendurada no topo da tela */}
      <View style={{ height: stage }}>
        <View style={[styles.lantern, { left: (width - lanternW) / 2 }]}>
          <Baiu score={folego.score} width={lanternW} cord={cord} interactive />
        </View>
        <View pointerEvents="box-none" style={[styles.topbar, { top: insets.top + 6 }]}>
          <View style={{ flexShrink: 1 }}>
            <T variant="title3">{greeting()}</T>
            <T variant="caption" tone="ink3">
              {longToday()}
            </T>
          </View>
          <View style={styles.topActions}>
            <IconButton
              icon={hide ? 'eyeOff' : 'eye'}
              label={hide ? 'Mostrar valores' : 'Ocultar valores'}
              onPress={() => dispatch({ type: 'toggleHide' })}
            />
            <IconButton icon="settings" label="Ajustes" onPress={() => router.push('/ajustes')} />
          </View>
        </View>
      </View>

      {/* humor e fôlego */}
      <View style={styles.center}>
        <T variant="title2" align="center">
          {folego.mood.line}
        </T>
        <Link href="/folego" asChild>
          <Pressable
            style={styles.folegoChip}
            accessibilityRole="button"
            accessibilityLabel={`Fôlego ${folego.score} de 100. Ver por quê.`}>
            <Mark state="parcial" fill={folego.score / 100} size={18} />
            <T variant="calloutStrong" tabular>
              Fôlego {folego.score}
            </T>
            <T variant="callout" tone="ink3">
              de 100
            </T>
            <Icon name="chevron" size={12} tint={color.ink3} weight="semibold" />
          </Pressable>
        </Link>
      </View>

      {/* saldo */}
      <View style={[styles.center, { marginTop: 26 }]}>
        <T variant="caption" tone="ink2">
          Saldo nas contas
        </T>
        <BigMoney value={s.saldo} size={Math.min(46, width * 0.115)} />
        <T variant="caption" tone="ink2" align="center" tabular>
          {hide ? HIDDEN : brl(s.investido)} investidos
          {fatura ? ` · fatura ${hide ? HIDDEN : brl(s.fatura)} vence dia ${fatura.dueDay}` : ''}
        </T>
      </View>

      {/* próximo hábito */}
      <Pressable
        onPress={() => router.push('/folego')}
        style={({ pressed }) => [styles.habit, pressed && { backgroundColor: color.plateHi }]}
        accessibilityRole="button">
        <View style={styles.habitGlyph}>
          <Icon name="bolt" size={16} tint={color.night} weight="semibold" />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="captionStrong" tone="lantern">
            Próximo passo
          </T>
          <T variant="callout">{hide ? folego.habit.text.replace(/R\$\s?[\d.,]+/g, 'um valor') : folego.habit.text}</T>
        </View>
        <Icon name="chevron" size={13} tint={color.ink3} weight="semibold" />
      </Pressable>

      {/* contas */}
      <Section title="Contas" link="/contas" linkLabel="Ver todas" style={{ paddingHorizontal: 0 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {state.accounts.map((a) => (
            <AccountPlate key={a.id} account={a} />
          ))}
          <Pressable
            onPress={() => router.push('/nova-conta')}
            style={({ pressed }) => [styles.addPlate, pressed && { backgroundColor: color.plate }]}
            accessibilityRole="button">
            <View style={styles.addCircle}>
              <Icon name="plus" size={18} tint={color.lantern} weight="semibold" />
            </View>
            <T variant="calloutStrong" tone="lantern">
              Adicionar conta
            </T>
          </Pressable>
        </ScrollView>
      </Section>

      {/* mês */}
      <Section title="Últimos 30 dias" link="/extrato" linkLabel="Extrato">
        <View style={styles.flowRow}>
          <Flow label="Entrou" value={s.entradas} tone="jade" />
          <Flow label="Saiu" value={-s.gastos} tone="paper" />
          <Flow label="Guardou" value={s.aportes + s.guardado} tone="lantern" />
        </View>
        <View style={{ marginTop: 18 }}>
          <DayBars bars={bars} />
        </View>
      </Section>

      {/* movimentos */}
      <Section title="Movimentos" link="/extrato" linkLabel="Ver extrato">
        <Plate style={{ paddingHorizontal: 14 }}>
          {recent.map((tx, i) => (
            <View key={tx.id}>
              {i > 0 && <Rule inset={50} />}
              <TxRow tx={tx} account={accountsById.get(tx.accountId)} />
            </View>
          ))}
        </Plate>
      </Section>

      {/* selos */}
      <Section title="Selos" link="/selos" linkLabel="Ver todos">
        <Plate style={styles.sealRow}>
          {seals.map((x, i) => (
            <View key={x.id} style={styles.sealCell}>
              <Seal lines={x.lines} date={x.date} earned size={92} ground={color.plate} seed={i + 3} />
            </View>
          ))}
        </Plate>
      </Section>

      <DemoNote />
    </ScrollView>
  );
}

function AccountPlate({ account }: { account: Account }) {
  const bank = bankById(account.bankId);
  const card = account.kind === 'cartao';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/conta/[id]', params: { id: account.id } })}
      style={({ pressed }) => [styles.accPlate, pressed && { backgroundColor: color.plateHi }]}
      accessibilityRole="button"
      accessibilityLabel={`${bank.name}, ${KIND_LABEL[account.kind]}`}>
      <BankMark bankId={account.bankId} size={34} />
      <View style={{ marginTop: 14 }}>
        <T variant="captionStrong" numberOfLines={1}>
          {account.nickname ?? bank.name}
        </T>
        <T variant="micro" tone="ink3" numberOfLines={1}>
          {card ? `Fatura · vence dia ${account.dueDay}` : account.nickname ? bank.name : KIND_LABEL[account.kind]}
        </T>
      </View>
      <View style={{ marginTop: 8 }}>
        <Money value={card ? -account.balance : account.balance} variant="bodyStrong" />
      </View>
    </Pressable>
  );
}

function Flow({ label, value, tone }: { label: string; value: number; tone: 'jade' | 'paper' | 'lantern' }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.flowLabel}>
        <View style={[styles.flowDot, { backgroundColor: color[tone] }]} />
        <T variant="caption" tone="ink2">
          {label}
        </T>
      </View>
      <Money value={value} variant="bodyStrong" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  lantern: { position: 'absolute', top: 0 },
  topbar: {
    position: 'absolute',
    zIndex: 2,
    left: gutter,
    right: gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topActions: { flexDirection: 'row', gap: 8 },
  center: { alignItems: 'center', paddingHorizontal: gutter },
  folegoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
    backgroundColor: 'rgba(22, 35, 77, 0.6)',
  },
  habit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: gutter,
    marginTop: 26,
    padding: 14,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  habitGlyph: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: color.lantern,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: { paddingHorizontal: gutter, gap: 10 },
  accPlate: {
    width: 150,
    padding: 14,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  addPlate: {
    width: 150,
    padding: 14,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 182, 72, 0.45)',
    justifyContent: 'space-between',
  },
  addCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lanternWash,
  },
  flowRow: { flexDirection: 'row', gap: 12 },
  flowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  flowDot: { width: 7, height: 7, borderRadius: 4 },
  sealRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 18,
  },
  sealCell: { alignItems: 'center' },
});
