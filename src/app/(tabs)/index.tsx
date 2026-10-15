import { Link, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu, baiuHeight } from '@/components/baiu/baiu';
import { useBaiuLook } from '@/components/baiu/use-look';
import { BankMark } from '@/components/bank-mark';
import { Button, IconButton } from '@/components/button';
import { DayBars } from '@/components/day-bars';
import { EmptyPlate } from '@/components/form';
import { GroundLight } from '@/components/ground-light';
import { Icon } from '@/components/icon';
import { DemoNote, Plate, Rule, Section } from '@/components/layout';
import { Mark } from '@/components/mark';
import { BigMoney, Money } from '@/components/money';
import { Seal } from '@/components/seal';
import { TxRow } from '@/components/tx-row';
import { bankById, KIND_LABEL } from '@/data/banks';
import type { Account } from '@/data/types';
import { dueItems, dueLabel } from '@/lib/bills';
import { paletteFor } from '@/lib/look';
import { greeting, longToday } from '@/lib/dates';
import { accountTotal } from '@/lib/ledger';
import { brl, HIDDEN } from '@/lib/money';
import { sealsFor } from '@/lib/seals';
import { dailySpending, last30, sortedTxs } from '@/lib/summary';
import { useAccountsById, useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

export default function Home() {
  const { state, dispatch } = useStore();
  const folego = useFolego();
  const accountsById = useAccountsById();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const s = folego.summary;
  const bars = useMemo(() => dailySpending(state, last30()), [state]);
  const recent = useMemo(() => sortedTxs(state).slice(0, 4), [state]);
  const dues = useMemo(() => dueItems(state).slice(0, 3), [state]);
  const allSeals = useMemo(() => sealsFor(state), [state]);
  const earned = allSeals.filter((x) => x.earned);
  const seals = earned.length > 0 ? earned.slice(-3).reverse() : allSeals.slice(0, 3);

  const look = useBaiuLook();
  const fishW = Math.min(230, Math.round(width * 0.58));
  const fishTop = insets.top + 26;
  const fishH = baiuHeight(fishW);
  const stage = fishTop + fishH * 0.96;
  const pal = paletteFor(look.color, folego.mood.mood);
  const hide = state.settings.hideValues;
  const hasAccounts = state.accounts.length > 0;

  const card = state.accounts.find((a) => a.kind === 'cartao' && a.balance > 0);
  const subline = [
    s.investido > 0 ? `${hide ? HIDDEN : brl(s.investido)} investidos` : null,
    card ? `fatura ${hide ? HIDDEN : brl(s.fatura)} vence dia ${card.dueDay}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
        cy={fishTop + fishH * 0.56}
        intensity={0.35 + pal.glow * 0.65}
        tint={pal.glowColor}
      />

      {/* palco: o Baiu boiando no topo da tela */}
      <View style={{ height: stage }}>
        <View style={[styles.fish, { left: (width - fishW) / 2, top: fishTop }]}>
          <Baiu score={folego.score} width={fishW} interactive />
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
              icon="plus"
              label="Registrar movimento"
              tint={color.lantern}
              onPress={() => router.push(hasAccounts ? '/movimento/novo' : '/nova-conta')}
            />
            <IconButton
              icon={hide ? 'eyeOff' : 'eye'}
              label={hide ? 'Mostrar valores' : 'Ocultar valores'}
              onPress={() => dispatch({ type: 'setSetting', key: 'hideValues', value: !hide })}
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
        {subline ? (
          <T variant="caption" tone="ink2" align="center" tabular>
            {subline}
          </T>
        ) : null}
      </View>

      {/* próximo hábito */}
      <Pressable
        onPress={() => router.push(hasAccounts ? '/folego' : '/nova-conta')}
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
      <Section title="Contas" link={hasAccounts ? '/contas' : undefined} linkLabel="Ver todas" bleed>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {state.accounts.map((a) => (
            <AccountPlate key={a.id} account={a} total={accountTotal(a, state.holdings)} />
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

      {/* vencimentos */}
      {hasAccounts && (
        <Section title="Vencimentos" link="/vencimentos" linkLabel={dues.length ? 'Ver todos' : 'Abrir'}>
          {dues.length === 0 ? (
            <EmptyPlate text="Cadastre boletos e contas fixas para o Baiu avisar antes do vencimento.">
              <Button
                label="Adicionar vencimento"
                kind="secondary"
                icon="plus"
                onPress={() => router.push('/vencimento/novo')}
              />
            </EmptyPlate>
          ) : (
            <Plate style={{ paddingHorizontal: 14 }}>
              {dues.map((d, i) => (
                <View key={d.key}>
                  {i > 0 && <Rule inset={36} />}
                  <Pressable
                    style={({ pressed }) => [styles.dueRow, pressed && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    onPress={() =>
                      d.billId
                        ? router.push({ pathname: '/vencimento/[id]', params: { id: d.billId } })
                        : router.push({ pathname: '/conta/[id]', params: { id: d.accountId! } })
                    }>
                    <Mark state={d.overdue ? 'riscada' : 'vazia'} />
                    <View style={{ flex: 1 }}>
                      <T variant="calloutStrong" numberOfLines={1}>
                        {d.title}
                      </T>
                      <T variant="caption" tone={d.overdue ? 'vermilion' : 'ink3'}>
                        {dueLabel(d.due)}
                      </T>
                    </View>
                    <Money value={-d.amount} variant="calloutStrong" />
                  </Pressable>
                </View>
              ))}
            </Plate>
          )}
        </Section>
      )}

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
      <Section title="Movimentos" link={recent.length ? '/extrato' : undefined} linkLabel="Ver extrato">
        {recent.length === 0 ? (
          <EmptyPlate
            text={
              hasAccounts
                ? 'Nenhum movimento ainda. Registre o que entrou e o que saiu para o Baiu medir seu mês.'
                : 'Cadastre suas contas primeiro. Depois, cada entrada e cada gasto aparecem aqui.'
            }
          />
        ) : (
          <Plate style={{ paddingHorizontal: 14 }}>
            {recent.map((tx, i) => (
              <View key={tx.id}>
                {i > 0 && <Rule inset={50} />}
                <TxRow
                  tx={tx}
                  accounts={accountsById}
                  onPress={() => router.push({ pathname: '/movimento/[id]', params: { id: tx.id } })}
                />
              </View>
            ))}
          </Plate>
        )}
      </Section>

      {/* selos */}
      <Section title="Selos" link="/selos" linkLabel="Ver todos">
        <Plate style={styles.sealRow}>
          {seals.map((x, i) => (
            <View key={x.id} style={styles.sealCell}>
              <Seal lines={x.lines} date={x.date} earned={x.earned} size={92} ground={color.plate} seed={i + 3} />
            </View>
          ))}
        </Plate>
        {earned.length === 0 && (
          <T variant="caption" tone="ink3" style={{ marginTop: 10 }}>
            Cada hábito que cuida do seu dinheiro vira um carimbo. O primeiro vem com a primeira conta.
          </T>
        )}
      </Section>

      {state.demo && <DemoNote />}
    </ScrollView>
  );
}

function AccountPlate({ account, total }: { account: Account; total: number }) {
  const bank = bankById(account.bankId);
  const card = account.kind === 'cartao';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/conta/[id]', params: { id: account.id } })}
      style={({ pressed }) => [styles.accPlate, pressed && { backgroundColor: color.plateHi }]}
      accessibilityRole="button"
      accessibilityLabel={`${account.nickname ?? bank.name}, ${KIND_LABEL[account.kind]}`}>
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
        <Money value={card ? -account.balance : total} variant="bodyStrong" />
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
  fish: { position: 'absolute', top: 0 },
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
    minHeight: 132,
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
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 },
  flowRow: { flexDirection: 'row', gap: 12 },
  flowLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  flowDot: { width: 7, height: 7, borderRadius: 4 },
  sealRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 18 },
  sealCell: { alignItems: 'center' },
});
