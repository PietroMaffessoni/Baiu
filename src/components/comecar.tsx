import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CULPA,
  IDADE,
  JUROS_FAMILIAS,
  OBJETIVOS,
  ORIGENS,
  PARA,
  RELATOS,
  RICOS,
  SOZINHO,
  type Objetivo,
  type Para,
  type Stat,
} from '@/content/comecar';
import { ESCAPE_MEDIO, JUROS_POR_SEGUNDO, projection, saveOrigin, savingsValue } from '@/lib/comecar';
import { brl } from '@/lib/money';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';
import { Baiu, baiuHeight } from './baiu/baiu';
import { BankMark } from './bank-mark';
import { Button, IconButton } from './button';
import { Icon, type IconName } from './icon';
import { tick } from './keypad';
import { Slider } from './slider';

type StepId =
  | 'para'
  | 'app1'
  | 'app2'
  | 'origem'
  | 'escape'
  | 'idade'
  | 'conta'
  | 'coisas'
  | 'poupanca'
  | 'sozinho'
  | 'culpa'
  | 'contador'
  | 'relatos'
  | 'ricos'
  | 'objetivo'
  | 'fim';

/** Os relatos só entram quando houver relatos reais. */
const STEPS = (
  [
    'para',
    'app1',
    'app2',
    'origem',
    'escape',
    'idade',
    'conta',
    'coisas',
    'poupanca',
    'sozinho',
    'culpa',
    'contador',
    'relatos',
    'ricos',
    'objetivo',
    'fim',
  ] as StepId[]
).filter((s) => s !== 'relatos' || RELATOS.length > 0);

/** Fôlego do Baiu em cada tela: murcha com as contas, enche quando ele entra na história. */
const SCORE: Record<StepId, number> = {
  para: 50,
  app1: 60,
  app2: 72,
  origem: 50,
  escape: 30,
  idade: 36,
  conta: 10,
  coisas: 8,
  poupanca: 6,
  sozinho: 14,
  culpa: 22,
  contador: 12,
  relatos: 60,
  ricos: 60,
  objetivo: 80,
  fim: 92,
};

/** Perguntas e telas do app ficam sem o Baiu em cima, para o conteúdo caber. */
const NO_FISH: StepId[] = ['para', 'app1', 'app2', 'origem', 'idade'];

const reais = (v: number) => brl(v, { cents: false });
const count = (n: number) => n.toLocaleString('pt-BR');

/**
 * O caminho de quem baixou o Baiu até criar a conta. Primeiro a pessoa conta
 * para quem é o app e vê como ele funciona; depois vê quanto escapa por mês do
 * bolso do brasileiro, diz a idade e vê o tamanho disso na vida inteira, em
 * coisas e na poupança. Aí vêm os dados de que ela não está sozinha e de que
 * não é culpa dela, e uma simulação com o objetivo dela. No fim, o Baiu enche.
 *
 * `rever`: aberto pelos Ajustes, termina fechando e não guarda nada.
 * `onBack`: para onde volta o primeiro passo (sem ele, fecha).
 */
export function Comecar({
  mode,
  onClose,
  onBack,
}: {
  mode: 'novo' | 'rever';
  onClose: () => void;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [para, setPara] = useState<Para | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);
  const [idade, setIdade] = useState(IDADE.start);
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);

  const step = STEPS[index];
  const final = step === 'fim';
  const casa = para === 'casa';
  // a média do brasileiro (ou da casa brasileira) é a base de todas as contas
  const escape = ESCAPE_MEDIO[para ?? 'eu'];
  const p = projection(escape, idade);
  const dono = casa ? 'da sua casa' : 'do seu bolso';
  const quem = casa ? 'de cada casa brasileira' : 'do bolso de cada brasileiro';
  const score = SCORE[step];

  useEffect(() => {
    if (final && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [final]);

  const ready = step === 'para' ? !!para : step === 'origem' ? !!origem : step === 'objetivo' ? !!objetivo : true;

  const next = () => {
    if (step === 'origem' && origem && mode === 'novo') saveOrigin(origem);
    if (final) {
      if (mode === 'rever') onClose();
      else router.push('/cadastro');
      return;
    }
    setIndex((i) => i + 1);
  };
  const back = () => (index === 0 ? (onBack ?? onClose)() : setIndex((i) => i - 1));

  // em telas baixas o Baiu encolhe para o texto caber
  const avail = height - insets.top - insets.bottom;
  const fish = !NO_FISH.includes(step);
  const fishW = Math.min(150, Math.round(width * 0.4), Math.round(avail * 0.17));
  const fishH = baiuHeight(fishW);
  const top = insets.top + 8;

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: top }]}>
        <IconButton icon="back" label={index === 0 ? 'Fechar' : 'Voltar'} onPress={back} />
        <View
          style={styles.progress}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Passo ${index + 1} de ${STEPS.length}`}>
          <View style={[styles.progressFill, { width: `${((index + 1) / STEPS.length) * 100}%` }]} />
        </View>
        {final ? (
          <View style={{ width: 44 }} />
        ) : (
          <Pressable
            onPress={() => setIndex(STEPS.length - 1)}
            accessibilityRole="button"
            hitSlop={10}
            style={styles.skip}>
            <T variant="calloutStrong" tone="lantern">
              Pular
            </T>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 18 }]}
        bounces={false}>
        {fish ? (
          <View style={{ height: fishH * 0.96, alignItems: 'center' }}>
            <Baiu score={score} width={fishW} />
          </View>
        ) : null}

        <Animated.View key={step} entering={FadeInDown.duration(450)} style={styles.body}>
          {step === 'para' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Para quem é o Baiu?
              </T>
              <Options options={PARA} value={para} onChange={setPara} />
            </>
          ) : null}

          {step === 'app1' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Todas as suas contas num lugar só
              </T>
              <MockContas />
            </>
          ) : null}

          {step === 'app2' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Veja para onde vai cada real
              </T>
              <MockGastos />
            </>
          ) : null}

          {step === 'origem' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Como você conheceu o Baiu?
              </T>
              <Options options={ORIGENS} value={origem} onChange={setOrigem} compact />
            </>
          ) : null}

          {step === 'escape' ? (
            <>
              <T variant="body" tone="ink2" accessibilityRole="header">
                {`Todo mês, escapam em média ${quem}`}
              </T>
              <CountUp value={escape} format={reais} spoken={reais(escape)} />
              <T variant="title2">só em juros.</T>
              <T variant="callout" tone="ink2">
                {`Foi para os juros ${JUROS_FAMILIAS.renda} de tudo o que as famílias brasileiras ganharam no primeiro semestre de 2026. E isso sem contar assinatura esquecida, delivery por impulso, tarifa do banco e aquele Pix que ninguém lembra.`}
              </T>
            </>
          ) : null}

          {step === 'idade' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Quantos anos você tem?
              </T>
              <T variant="body" tone="ink2">
                Para a conta ir até onde a sua vida vai.
              </T>
              <View style={styles.reading}>
                <T variant="display" tabular style={styles.number}>
                  {idade}
                </T>
                <T variant="title3" tone="ink2">
                  anos
                </T>
              </View>
              <Slider
                value={idade}
                min={IDADE.min}
                max={IDADE.max}
                step={1}
                onChange={setIdade}
                label="Sua idade"
                spoken={(v) => `${v} anos`}
              />
            </>
          ) : null}

          {step === 'conta' ? (
            <>
              <T variant="body" tone="ink2">
                {`Se for assim com você, até os ${p.untilAge} anos vão escapar ${dono}`}
              </T>
              <CountUp value={p.total} format={reais} spoken={reais(p.total)} />
              <T variant="title2">{`São ${reais(escape * 12)} por ano, durante ${p.years} anos.`}</T>
              <T variant="callout" tone="ink2">
                Dinheiro que sai aos poucos, sem barulho, e que você nunca vê junto.
              </T>
            </>
          ) : null}

          {step === 'coisas' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                {`${reais(p.total)} é o mesmo que…`}
              </T>
              <View style={styles.things}>
                {p.coisas.map((c, i) => (
                  <Animated.View key={c.key} entering={FadeIn.delay(200 + i * 220).duration(400)} style={styles.thing}>
                    <T variant="hero" tone="lantern" tabular>
                      {count(c.n)}
                    </T>
                    <T variant="title3" style={{ flex: 1 }}>
                      {c.n === 1 ? c.one : c.many}
                    </T>
                  </Animated.View>
                ))}
              </View>
            </>
          ) : null}

          {step === 'poupanca' ? (
            <>
              <T variant="body" tone="ink2">
                E se esse mesmo dinheiro ficasse guardado na poupança?
              </T>
              <CountUp value={p.poupanca} format={reais} spoken={reais(p.poupanca)} />
              <T variant="title2">{`Só de rendimento, seriam ${reais(p.poupanca - p.total)} a mais.`}</T>
              <T variant="callout" tone="ink2">
                E isso na poupança, que rende pouco. O problema quase nunca é ganhar pouco: é não ver para onde o
                dinheiro vai.
              </T>
            </>
          ) : null}

          {step === 'sozinho' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Você não está sozinho
              </T>
              {SOZINHO.map((s) => (
                <StatBlock key={s.value} stat={s} />
              ))}
            </>
          ) : null}

          {step === 'culpa' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                E não é culpa sua
              </T>
              <StatBlock stat={CULPA} />
            </>
          ) : null}

          {step === 'contador' ? (
            <>
              <T variant="body" tone="ink2">
                Desde que você abriu esta tela, as famílias brasileiras já pagaram
              </T>
              <JurosAoVivo />
              <T variant="title2">em juros.</T>
              <T variant="callout" tone="ink2">
                {`Foram R$ 515,4 bilhões só no primeiro semestre de 2026, ou ${brl(escape / 30)} por dia ${quem}.`}
              </T>
            </>
          ) : null}

          {step === 'relatos' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Quem usa o Baiu conta
              </T>
              {RELATOS.map((r) => (
                <View key={r.name} style={styles.quote}>
                  <T variant="body">{`“${r.text}”`}</T>
                  <T variant="caption" tone="ink2">{`${r.name}, ${r.city}`}</T>
                </View>
              ))}
            </>
          ) : null}

          {step === 'ricos' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Quem enriquece sabe para onde vai o dinheiro
              </T>
              <StatBlock stat={RICOS} />
            </>
          ) : null}

          {step === 'objetivo' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                O que você faria com esse dinheiro?
              </T>
              <Options options={OBJETIVOS} value={objetivo} onChange={setObjetivo} grid />
              {objetivo ? <Plano monthly={escape} objetivo={objetivo} /> : null}
            </>
          ) : null}

          {step === 'fim' ? (
            mode === 'novo' ? (
              <>
                <T variant="title1" accessibilityRole="header">
                  Comece hoje a ver para onde vai o seu dinheiro
                </T>
                <T variant="body" tone="ink2">
                  Crie sua conta e use o Baiu por um mês, de graça. Depois, a assinatura é cobrada pela loja do seu
                  celular, e você cancela quando quiser.
                </T>
                <T variant="callout" tone="lantern">
                  {`Em média, escapam ${reais(escape)} por mês ${quem}. Com o Baiu, você vê para onde vai ${casa ? 'o da sua' : 'o seu'}.`}
                </T>
              </>
            ) : (
              <>
                <T variant="title1" accessibilityRole="header">
                  O Baiu está com você
                </T>
                <T variant="body" tone="ink2">
                  Cada movimento que você vê é dinheiro que para de escapar sem você saber.
                </T>
              </>
            )
          ) : null}
        </Animated.View>

        <View style={{ flex: 1, minHeight: 24 }} />
        <View style={{ gap: 8 }}>
          <Button
            label={final ? (mode === 'novo' ? 'Criar minha conta' : 'Fechar') : 'Continuar'}
            onPress={next}
            disabled={!ready}
          />
          {final && mode === 'novo' ? (
            <Button label="Já tenho conta" kind="quiet" onPress={() => router.push('/entrar')} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Escolha única em cartões grandes, com ícone. */
function Options<V extends string>({
  options,
  value,
  onChange,
  compact,
  grid,
}: {
  options: { value: V; label: string; hint?: string; icon: IconName }[];
  value: V | null;
  onChange: (v: V) => void;
  compact?: boolean;
  /** Duas colunas de quadros, para a resposta caber logo abaixo. */
  grid?: boolean;
}) {
  return (
    <View style={[styles.options, (compact || grid) && { gap: 8 }, grid && styles.grid]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tick();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            accessibilityHint={o.hint}
            style={({ pressed }) => [
              styles.option,
              compact && styles.optionCompact,
              grid && styles.optionTile,
              on && styles.optionOn,
              pressed && { opacity: 0.85 },
            ]}>
            <View style={[styles.optionIcon, on && { backgroundColor: color.lantern }]}>
              <Icon name={o.icon} size={18} tint={on ? color.night : color.lantern} />
            </View>
            <View style={{ flex: grid ? undefined : 1, gap: 2 }}>
              <T variant={grid ? 'calloutStrong' : 'bodyStrong'}>{o.label}</T>
              {o.hint ? (
                <T variant="caption" tone="ink2">
                  {o.hint}
                </T>
              ) : null}
            </View>
            {on && !grid ? <Icon name="check" size={18} tint={color.lantern} weight="semibold" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Um dado: número grande e frase. A fonte fica no conteúdo, não na tela. */
function StatBlock({ stat }: { stat: Stat }) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="hero" tone="lantern" accessibilityLabel={stat.spoken}>
        {stat.value}
      </T>
      <T variant="title3">{stat.title}</T>
      <T variant="callout" tone="ink2">
        {stat.detail}
      </T>
    </View>
  );
}

/** Simulação do objetivo: guardar na poupança tudo o que escapa por mês. */
function Plano({ monthly, objetivo }: { monthly: number; objetivo: Objetivo }) {
  const o = OBJETIVOS.find((x) => x.value === objetivo)!;
  const ano = savingsValue(monthly, 12);
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.plan}>
      <T variant="callout" tone="ink2">
        {`Guardando esses ${reais(monthly)} por mês na poupança, em 1 ano você junta`}
      </T>
      <T variant="hero" tone="lantern" tabular>
        {reais(ano)}
      </T>
      <T variant="callout">{`para ${o.para}. Em 5 anos, ${reais(savingsValue(monthly, 60))}.`}</T>
    </Animated.View>
  );
}

/** Contador ao vivo dos juros pagos pelas famílias desde que a tela abriu. */
function JurosAoVivo() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  return (
    <T
      variant="display"
      tone="vermilion"
      tabular
      numberOfLines={1}
      adjustsFontSizeToFit
      style={styles.number}
      accessibilityLabel={`Valor que sobe cerca de ${reais(JUROS_POR_SEGUNDO)} por segundo`}>
      {reais(((now - start) / 1000) * JUROS_POR_SEGUNDO)}
    </T>
  );
}

/** O número sobe até o valor final. Com Reduzir Movimento, aparece direto. */
function CountUp({ value, format, spoken }: { value: number; format: (n: number) => string; spoken: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const start = Date.now();
    const run = () => {
      const t = Math.min(1, (Date.now() - start) / 1300);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return (
    <T
      variant="display"
      tone="lantern"
      tabular
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLabel={spoken}
      style={styles.number}>
      {format(reduce ? value : shown)}
    </T>
  );
}

/** Como fica a tela de contas, com bancos de exemplo. */
function MockContas() {
  const rows = [
    { bank: 'nubank', name: 'Nubank', kind: 'Conta', value: 1932.15 },
    { bank: 'itau', name: 'Itaú', kind: 'Conta', value: 2286.25 },
    { bank: 'caixa', name: 'Caixa', kind: 'Fatura do cartão', value: -640.9 },
  ];
  const moves = [
    { title: 'Mercado', value: -187.32 },
    { title: 'Salário', value: 3200 },
  ];
  return (
    <View
      style={styles.mock}
      accessible
      accessibilityLabel="Exemplo: o saldo de três bancos somado num lugar só, com a fatura do cartão e os últimos movimentos">
      <T variant="caption" tone="ink2">
        Saldo nas contas
      </T>
      <T variant="title1" tabular>
        {brl(4218.4)}
      </T>
      <View style={styles.mockRows}>
        {rows.map((r) => (
          <View key={r.bank} style={styles.mockRow}>
            <BankMark bankId={r.bank} size={32} />
            <View style={{ flex: 1 }}>
              <T variant="calloutStrong">{r.name}</T>
              <T variant="caption" tone="ink3">
                {r.kind}
              </T>
            </View>
            <T variant="calloutStrong" tabular>
              {brl(r.value)}
            </T>
          </View>
        ))}
      </View>
      <View style={styles.mockLine} />
      {moves.map((m) => (
        <View key={m.title} style={styles.mockRow}>
          <Icon name={m.value > 0 ? 'income' : 'basket'} size={16} tint={m.value > 0 ? color.jade : color.ink2} />
          <T variant="callout" style={{ flex: 1 }}>
            {m.title}
          </T>
          <T variant="callout" tabular tone={m.value > 0 ? 'jade' : 'paper'}>
            {brl(m.value, { sign: 'always' })}
          </T>
        </View>
      ))}
    </View>
  );
}

/** O mês por categoria, com o aviso do Baiu no gasto que fugiu do normal. Valores de exemplo. */
function MockGastos() {
  const rows: { icon: IconName; title: string; value: number; off?: boolean }[] = [
    { icon: 'basket', title: 'Mercado', value: 1120 },
    { icon: 'home', title: 'Contas da casa', value: 640 },
    { icon: 'food', title: 'Delivery', value: 412, off: true },
    { icon: 'car', title: 'Transporte', value: 286 },
    { icon: 'repeat', title: 'Assinaturas', value: 118 },
  ];
  const top = rows[0].value;
  return (
    <View
      style={{ gap: 10 }}
      accessible
      accessibilityLabel="Exemplo: os gastos do mês por categoria, e o Baiu avisando que o delivery está no dobro do normal">
      <View style={styles.mock}>
        <T variant="caption" tone="ink2">
          Gastos de outubro
        </T>
        <T variant="title1" tabular>
          {brl(rows.reduce((a, r) => a + r.value, 0))}
        </T>
        <View style={styles.mockRows}>
          {rows.map((r, i) => (
            <View key={r.title} style={{ gap: 6 }}>
              <View style={styles.mockRow}>
                <Icon name={r.icon} size={16} tint={r.off ? color.vermilion : color.ink2} />
                <T variant="callout" style={{ flex: 1 }}>
                  {r.title}
                </T>
                <T variant="calloutStrong" tabular tone={r.off ? 'vermilion' : 'paper'}>
                  {brl(r.value, { cents: false })}
                </T>
              </View>
              <View style={styles.track}>
                <Animated.View
                  entering={FadeIn.delay(250 + i * 120).duration(500)}
                  style={[
                    styles.trackFill,
                    { width: `${(r.value / top) * 100}%` },
                    r.off && { backgroundColor: color.vermilion },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
      <Animated.View entering={FadeInDown.delay(900).duration(400)} style={[styles.notice, { alignItems: 'center' }]}>
        <Baiu score={30} width={52} still />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="calloutStrong">Delivery no dobro do seu normal</T>
          <T variant="caption" tone="ink2">
            R$ 412 este mês. Nos últimos três, a média foi R$ 205.
          </T>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: gutter, paddingBottom: 8 },
  progress: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.plateHi, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: color.lantern },
  skip: { minWidth: 44, alignItems: 'flex-end' },
  content: { flexGrow: 1, paddingHorizontal: gutter, paddingTop: 12 },
  body: { gap: 12, marginTop: 8 },
  number: { fontSize: 52, lineHeight: 62 },
  reading: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  things: { gap: 14, marginTop: 4 },
  thing: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  options: { gap: 10, marginTop: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.plate,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  optionCompact: { paddingVertical: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  optionTile: {
    width: '48.5%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    minHeight: 96,
  },
  optionOn: { borderColor: color.lantern, backgroundColor: color.lanternWash },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lanternWash,
  },
  quote: { gap: 6, padding: 16, borderRadius: radius.plate, backgroundColor: color.plate },
  plan: {
    gap: 4,
    padding: 16,
    marginTop: 4,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.plate,
  },
  mock: {
    padding: 16,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.nightDeep,
    borderWidth: 1,
    borderColor: color.lineStrong,
    gap: 2,
  },
  mockRows: { gap: 10, marginTop: 12 },
  mockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  mockLine: { height: 1, backgroundColor: color.line, marginVertical: 8 },
  track: { height: 4, borderRadius: 2, backgroundColor: color.plateHi, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: color.ink3 },
  notice: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.plate,
  },
});
