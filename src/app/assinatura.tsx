import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { Button } from '@/components/button';
import { ListRow } from '@/components/form';
import { Icon, type IconName } from '@/components/icon';
import { Plate, Rule } from '@/components/layout';
import { withoutCurtain } from '@/components/lock-gate';
import { accountsCsv, transactionsCsv } from '@/lib/csv';
import { remindersAllowed } from '@/lib/reminders';
import { shareCsv } from '@/lib/share';
import { subMessage, SubFailure } from '@/lib/subscription/backend';
import { dateLabel, describe, periodLabel, priceLabel, STORE_NAMES, trialName } from '@/lib/subscription/status';
import type { Entitlement, Plan, SubStore } from '@/lib/subscription/types';
import { isLocked, useSubscription } from '@/lib/subscription/use-subscription';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

const SUPPORT = 'suporte.baiu@gmail.com';
const today = () => new Date().toISOString().slice(0, 10);

/** A loja deste aparelho, que é quem cobra. */
function deviceStore(fake: boolean): SubStore {
  if (fake) return 'teste';
  return Platform.OS === 'ios' ? 'app_store' : 'play_store';
}

/**
 * Assinatura do Baiu. Sem assinatura, mostra o que está incluso, o preço e as
 * condições, sem letras miúdas. Com assinatura, mostra o estado, a próxima
 * cobrança e o caminho para cancelar.
 */
export default function Assinatura() {
  const sub = useSubscription();
  const insets = useSafeAreaInsets();
  const locked = isLocked(sub, sub.enabled);
  const ent = sub.ent;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: !locked }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: locked ? insets.top + 24 : 8,
          paddingBottom: insets.bottom + 40,
          gap: 16,
        }}>
        {!sub.enabled ? (
          <Unavailable />
        ) : !sub.ready ? (
          <ActivityIndicator color={color.lantern} style={{ marginTop: 60 }} />
        ) : ent?.active ? (
          <Manage ent={ent} />
        ) : (
          <Paywall ent={ent} locked={locked} />
        )}
      </ScrollView>
    </View>
  );
}

function Unavailable() {
  const folego = useFolego();
  return (
    <View style={styles.center}>
      <Baiu score={folego.score} width={130} still />
      <T variant="title2" align="center">
        Assinaturas ainda não disponíveis
      </T>
      <T variant="callout" tone="ink2" align="center">
        Nesta versão do app, o Baiu está liberado. Quando a assinatura chegar, o primeiro mês será grátis.
      </T>
    </View>
  );
}

function usePlans() {
  const { plans, loadPlans } = useSubscription();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadPlans().catch((e) => setError(subMessage(e)));
  }, [loadPlans]);
  const retry = useCallback(() => {
    setError(null);
    loadPlans().catch((e) => setError(subMessage(e)));
  }, [loadPlans]);
  return { plans, error, retry };
}

/** Condições da assinatura, ditas antes de assinar (exigência das lojas e do Código de Defesa do Consumidor). */
function conditions(plan: Plan, store: string) {
  const charge = `${priceLabel(plan)}, cobrados na sua conta da ${store}, com renovação automática até você cancelar`;
  if (plan.trial) {
    return `Grátis por ${periodLabel(plan.trial)}. Depois, ${charge}. Para não ser cobrado, cancele até 24 horas antes do fim do período grátis, em Ajustes, Assinatura. Avisamos 2 dias antes.`;
  }
  return `${charge[0].toUpperCase()}${charge.slice(1)}. Cancele quando quiser, em Ajustes, Assinatura, até 24 horas antes da renovação; o cancelamento vale no fim do período já pago.`;
}

function Paywall({ ent, locked }: { ent: Entitlement | null; locked: boolean }) {
  const sub = useSubscription();
  const { state } = useStore();
  const folego = useFolego();
  const { plans, error: loadError, retry } = usePlans();
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const plan = plans?.find((p) => p.id === chosen) ?? plans?.[0] ?? null;
  const store = STORE_NAMES[deviceStore(sub.fake)];
  const returning = ent?.status === 'expirada';

  const done = async (e: Entitlement, trial: boolean) => {
    if (!e.active) return;
    // o aviso antes da cobrança vem por notificação: pede a permissão agora
    if (trial && Platform.OS !== 'web') await withoutCurtain(() => remindersAllowed(true)).catch(() => false);
    if (locked) router.replace('/');
  };

  const buy = async () => {
    if (!plan) return;
    setBusy('buy');
    setError(null);
    setNote(null);
    try {
      await done(await sub.purchase(plan.id), !!plan.trial);
    } catch (e) {
      if (!(e instanceof SubFailure && e.code === 'cancelled')) setError(subMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    setError(null);
    setNote(null);
    try {
      const e = await sub.restore();
      if (e.active) await done(e, false);
      else setNote(`Não encontramos uma assinatura ativa nesta conta da ${store}.`);
    } catch (e) {
      setError(subMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const trial = plan?.trial ?? plans?.find((p) => p.trial)?.trial ?? null;

  return (
    <>
      <View style={styles.center}>
        <Baiu score={Math.max(folego.score, 60)} width={120} />
        <T variant="title1" align="center" accessibilityRole="header">
          {trial ? 'Seu primeiro mês é por nossa conta' : returning ? 'Que bom te ver de novo' : 'Assine o Baiu'}
        </T>
        <T variant="body" tone="ink2" align="center">
          {returning && locked
            ? 'Sua assinatura terminou. Seus registros continuam guardados neste aparelho: assine de novo para continuar de onde parou.'
            : trial && plan
              ? `Use tudo por ${periodLabel(trial)} sem pagar nada. Depois, ${priceLabel(plans!.find((p) => p.period === 'mes') ?? plan)}. Cancele quando quiser.`
              : plan
                ? `${priceLabel(plan)}. Cancele quando quiser.`
                : 'Organize seu dinheiro sem digitar nada.'}
        </T>
      </View>

      <Plate style={styles.plate}>
        <Point
          icon="bank"
          title="Bancos conectados"
          text="Cada entrada e saída chega sozinha, já separada por categoria."
        />
        <Point
          icon="chat"
          title="O Baiu do seu lado"
          text="Avisa quando um gasto foge do normal e tira dúvidas sobre o seu dinheiro."
        />
        <Point
          icon="calendar"
          title="Fôlego e vencimentos"
          text="Sua saúde financeira em uma nota e um lembrete antes de cada conta."
        />
        <Point
          icon="lock"
          title="Privado de verdade"
          text="Seus registros ficam criptografados no seu celular. Sem anúncios e sem venda de dados."
        />
      </Plate>

      {!plans ? (
        loadError ? (
          <View style={{ gap: 10 }}>
            <T variant="callout" tone="vermilion" align="center">
              {loadError}
            </T>
            <Button label="Tentar de novo" kind="secondary" onPress={retry} />
          </View>
        ) : (
          <ActivityIndicator color={color.lantern} />
        )
      ) : plans.length === 0 ? (
        <T variant="callout" tone="ink2" align="center">
          A assinatura não está disponível na sua loja agora. Tente de novo mais tarde.
        </T>
      ) : (
        <>
          {plans.length > 1 ? (
            <View style={{ gap: 10 }} accessibilityRole="radiogroup">
              {plans.map((p) => (
                <PlanOption key={p.id} plan={p} selected={p.id === plan?.id} onPress={() => setChosen(p.id)} />
              ))}
            </View>
          ) : null}
          {error ? (
            <T variant="callout" tone="vermilion" align="center">
              {error}
            </T>
          ) : null}
          {note ? (
            <T variant="callout" tone="ink2" align="center">
              {note}
            </T>
          ) : null}
          {plan ? (
            <>
              <Button
                label={plan.trial ? `Começar meu ${trialName(plan.trial)}` : `Assinar por ${priceLabel(plan)}`}
                onPress={buy}
                loading={busy === 'buy'}
                disabled={busy !== null}
              />
              <T variant="caption" tone="ink2" align="center">
                {conditions(plan, store)}
              </T>
            </>
          ) : null}
        </>
      )}

      <View style={styles.links}>
        <Link label="Restaurar compras" onPress={restore} busy={busy === 'restore'} />
        <T variant="caption" tone="ink3">
          ·
        </T>
        <Link label="Termos de uso" onPress={() => router.push('/termos')} />
        <T variant="caption" tone="ink3">
          ·
        </T>
        <Link label="Privacidade" onPress={() => router.push('/privacidade')} />
      </View>

      {locked ? <YourData hasData={state.txs.length > 0 || state.accounts.length > 0} /> : null}
    </>
  );
}

/** Sem assinatura, os dados continuam da pessoa: dá para levar, sair ou excluir a conta (LGPD). */
function YourData({ hasData }: { hasData: boolean }) {
  const { state } = useStore();
  const fail = (e: unknown) => Alert.alert('Não deu para exportar', String((e as Error)?.message ?? e));
  return (
    <View style={{ marginTop: 16, gap: 8 }}>
      <T variant="captionStrong" tone="ink3" style={{ marginLeft: 4 }}>
        Seus dados continuam seus
      </T>
      <Plate style={{ paddingHorizontal: 14 }}>
        {hasData ? (
          <>
            <ListRow
              icon="share"
              label="Exportar movimentos"
              hint="Planilha CSV com todos os registros."
              onPress={() => shareCsv(`baiu-movimentos-${today()}.csv`, transactionsCsv(state)).catch(fail)}
              chevron
            />
            <Rule inset={33} />
            <ListRow
              icon="share"
              label="Exportar contas"
              hint="Planilha CSV com saldos atuais."
              onPress={() => shareCsv(`baiu-contas-${today()}.csv`, accountsCsv(state)).catch(fail)}
              chevron
            />
            <Rule inset={33} />
          </>
        ) : null}
        <ListRow
          icon="settings"
          label="Minha conta"
          hint="Sair, ver seus dados ou excluir a conta."
          onPress={() => router.push('/minha-conta')}
          chevron
        />
      </Plate>
    </View>
  );
}

function Manage({ ent }: { ent: Entitlement }) {
  const sub = useSubscription();
  const { state, dispatch } = useStore();
  const folego = useFolego();
  const { plans } = usePlans();
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = plans?.find((p) => ent.productId && p.productId === ent.productId.split(':')[0]) ?? null;
  const store = ent.store ? STORE_NAMES[ent.store] : 'loja';
  const here = deviceStore(sub.fake);
  const elsewhere = ent.store !== null && ent.store !== 'outra' && ent.store !== here;
  const { title, detail } = describe(ent, plan);
  const until = ent.until ? dateLabel(ent.until) : null;

  const manage = async () => {
    setBusy(true);
    setError(null);
    try {
      await sub.manage();
      setCancelling(false);
    } catch (e) {
      setError(subMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const refund = () => {
    const url =
      ent.store === 'app_store'
        ? 'https://reportaproblem.apple.com'
        : ent.store === 'play_store'
          ? 'https://support.google.com/googleplay/answer/2479637'
          : `mailto:${SUPPORT}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <>
      <View style={styles.center}>
        <Baiu score={Math.max(folego.score, 60)} width={110} still />
        <T variant="title2" align="center" accessibilityRole="header">
          {title}
        </T>
        <T variant="callout" tone={ent.status === 'pagamento' ? 'vermilion' : 'ink2'} align="center">
          {detail}
        </T>
      </View>

      <Plate style={styles.plate}>
        <Line label="Plano" value={plan ? (plan.period === 'ano' ? 'Anual' : 'Mensal') : 'Baiu'} />
        {plan ? <Line label="Preço" value={priceLabel(plan)} /> : null}
        <Line label="Cobrada por" value={store} />
        {until ? (
          <Line
            label={
              ent.status === 'teste'
                ? 'Primeira cobrança'
                : ent.status === 'cancelada'
                  ? 'Acesso até'
                  : ent.status === 'pagamento'
                    ? 'Prazo para acertar'
                    : 'Próxima cobrança'
            }
            value={until}
          />
        ) : null}
      </Plate>

      {ent.status === 'teste' ? (
        <Plate style={{ paddingHorizontal: 14 }}>
          <ListRow
            icon="bell"
            label="Avisar antes da cobrança"
            hint="Uma notificação 2 dias antes do fim do mês grátis.">
            <Switch
              value={state.settings.trialReminder}
              onValueChange={async (on) => {
                if (on && Platform.OS !== 'web') await withoutCurtain(() => remindersAllowed(true)).catch(() => false);
                dispatch({ type: 'setSetting', key: 'trialReminder', value: on });
              }}
              trackColor={{ true: color.lantern, false: color.plateHi }}
              thumbColor={Platform.OS === 'android' ? color.paper : undefined}
              ios_backgroundColor={color.plateHi}
              accessibilityLabel="Avisar antes da cobrança"
            />
          </ListRow>
        </Plate>
      ) : null}

      {error ? (
        <T variant="callout" tone="vermilion" align="center">
          {error}
        </T>
      ) : null}

      {ent.status === 'pagamento' ? (
        <Button label="Atualizar forma de pagamento" onPress={manage} loading={busy} />
      ) : ent.status === 'cancelada' ? (
        <>
          <Button label="Voltar a assinar" onPress={manage} loading={busy} />
          <T variant="caption" tone="ink2" align="center">
            A renovação volta a valer pela {store}
            {until ? ` a partir de ${until}` : ''}. Até lá, nada muda.
          </T>
        </>
      ) : cancelling ? (
        <Plate style={{ padding: 16, gap: 10 }}>
          <T variant="bodyStrong">Como cancelar</T>
          <T variant="callout" tone="ink2">
            {elsewhere
              ? `Sua assinatura foi feita na ${store}, por isso o cancelamento é feito lá, no aparelho onde você assinou.`
              : `Quem cobra a assinatura é a ${store}, por isso o cancelamento é feito lá. No próximo passo, toque em Baiu e depois em Cancelar assinatura.`}
          </T>
          <T variant="callout" tone="ink2">
            Você continua usando tudo{until ? ` até ${until}` : ' até o fim do período'}
            {ent.status === 'teste' ? ' e não paga nada' : ' e não é cobrado de novo'}. Seus registros continuam neste
            aparelho.
          </T>
          <Button label={`Ir para a ${store}`} kind="danger" onPress={manage} loading={busy} />
          <Button label="Manter assinatura" kind="quiet" onPress={() => setCancelling(false)} />
        </Plate>
      ) : (
        <Button label="Cancelar assinatura" kind="secondary" onPress={() => setCancelling(true)} />
      )}

      <Plate style={{ paddingHorizontal: 14 }}>
        <ListRow
          icon="undo"
          label="Pedir reembolso"
          hint="Se você se arrepender de uma cobrança, tem até 7 dias para pedir o dinheiro de volta."
          onPress={refund}
          chevron
        />
        <Rule inset={33} />
        <ListRow icon="help" label="Falar com o suporte" onPress={() => Linking.openURL(`mailto:${SUPPORT}`)} chevron />
      </Plate>

      <View style={styles.links}>
        <Link label="Termos de uso" onPress={() => router.push('/termos')} />
        <T variant="caption" tone="ink3">
          ·
        </T>
        <Link label="Privacidade" onPress={() => router.push('/privacidade')} />
      </View>
    </>
  );
}

function PlanOption({ plan, selected, onPress }: { plan: Plan; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.period === 'ano' ? 'Anual' : 'Mensal'}, ${priceLabel(plan)}`}
      style={[styles.option, selected && styles.optionOn]}>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{plan.period === 'ano' ? 'Anual' : 'Mensal'}</T>
        <T variant="callout" tone="ink2">
          {priceLabel(plan)}
          {plan.perMonth ? ` · ${plan.perMonth} por mês` : ''}
        </T>
      </View>
      {plan.trial ? (
        <View style={styles.badge}>
          <T variant="micro" style={{ color: color.night, fontWeight: '700' }}>
            {plan.trial.count === 1 && plan.trial.unit === 'mes' ? '1º mês grátis' : trialName(plan.trial)}
          </T>
        </View>
      ) : null}
    </Pressable>
  );
}

function Point({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.glyph}>
        <Icon name={icon} size={18} tint={color.lantern} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="calloutStrong">{title}</T>
        <T variant="callout" tone="ink2">
          {text}
        </T>
      </View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <T variant="callout" tone="ink2">
        {label}
      </T>
      <T variant="calloutStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </T>
    </View>
  );
}

function Link({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" hitSlop={8}>
      <T variant="caption" tone={busy ? 'ink3' : 'lantern'}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  center: { alignItems: 'center', gap: 10, paddingTop: 4 },
  plate: { padding: 14, gap: 14 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lanternWash,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.plate,
    borderWidth: 1.5,
    borderColor: color.line,
    backgroundColor: color.plate,
  },
  optionOn: { borderColor: color.lantern, backgroundColor: color.plateHi },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: color.ink3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: color.lantern },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.lantern },
  badge: { backgroundColor: color.lantern, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
});
