import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CULPA,
  ESCAPE,
  IDADE,
  JUROS_FAMILIAS,
  OBJETIVOS,
  ORIGENS,
  PARA,
  PARTE_SEGURADA,
  PROMESSAS,
  REF,
  RELATOS,
  RICOS,
  SOZINHO,
  type Objetivo,
  type Para,
  type Stat,
} from '@/content/comecar';
import { JUROS_POR_SEGUNDO, projection, saveOrigin, savingsValue } from '@/lib/comecar';
import { brl } from '@/lib/money';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';
import { Baiu, baiuHeight } from './baiu/baiu';
import { BankMark } from './bank-mark';
import { Button, IconButton } from './button';
import { GroundLight } from './ground-light';
import { Icon, type IconName } from './icon';
import { tick } from './keypad';
import { Mark } from './mark';
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
  | 'ajuda'
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
    'ajuda',
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
  escape: 40,
  idade: 36,
  conta: 10,
  coisas: 8,
  poupanca: 6,
  sozinho: 14,
  culpa: 22,
  contador: 12,
  relatos: 60,
  ricos: 52,
  ajuda: 70,
  objetivo: 80,
  fim: 92,
};

/** Perguntas e telas do app ficam sem o Baiu em cima, para o conteúdo caber. */
const NO_FISH: StepId[] = ['para', 'app1', 'app2', 'origem', 'idade'];

const reais = (v: number) => brl(v, { cents: false });
const count = (n: number) => n.toLocaleString('pt-BR');

/**
 * O caminho de quem baixou o Baiu até criar a conta. Primeiro a pessoa conta
 * para quem é o app e vê como ele funciona; depois diz quanto escapa por mês e
 * a idade, e vê o tamanho disso na vida inteira, em coisas e na poupança. Aí
 * vêm os dados de que ela não está sozinha e de que não é culpa dela, como o
 * Baiu ajuda e uma simulação com o objetivo dela. No fim, o Baiu enche.
 *
 * `rever`: aberto pelos Ajustes, termina fechando e não guarda nada.
 */
export function Comecar({ mode, onClose }: { mode: 'novo' | 'rever'; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [para, setPara] = useState<Para | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);
  const [escape, setEscape] = useState(ESCAPE.eu.start);
  const [idade, setIdade] = useState(IDADE.start);
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);

  const step = STEPS[index];
  const final = step === 'fim';
  const range = ESCAPE[para ?? 'eu'];
  const p = projection(escape, idade);
  const dono = para === 'casa' ? 'da sua casa' : 'do seu bolso';

  // na régua, o Baiu murcha conforme o valor sobe
  const score =
    step === 'escape' ? Math.round(60 - (50 * (escape - range.min)) / (range.max - range.min)) : SCORE[step];

  useEffect(() => {
    if (final && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [final]);

  const choosePara = (v: Para) => {
    setPara(v);
    setEscape(ESCAPE[v].start);
  };

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
  const back = () => (index === 0 ? onClose() : setIndex((i) => i - 1));

  // em telas baixas o Baiu encolhe para o texto caber
  const avail = height - insets.top - insets.bottom;
  const fish = !NO_FISH.includes(step);
  const fishW = Math.min(150, Math.round(width * 0.4), Math.round(avail * 0.17));
  const fishH = baiuHeight(fishW);
  const top = insets.top + 8;

  return (
    <View style={styles.screen}>
      <GroundLight
        width={width}
        height={height * 0.7}
        cx={width / 2}
        cy={top + 60 + fishH * 0.56}
        intensity={fish ? 0.15 + (score / 100) * 0.85 : 0.2}
      />
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
              <T variant="body" tone="ink2">
                Assim as contas daqui para a frente ficam do seu tamanho.
              </T>
              <Options options={PARA} value={para} onChange={choosePara} />
            </>
          ) : null}

          {step === 'app1' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Todas as suas contas num lugar só
              </T>
              <T variant="body" tone="ink2">
                Conecte seus bancos pelo Open Finance e veja saldo, cartão e cada movimento sem abrir cinco apps.
              </T>
              <MockContas />
            </>
          ) : null}

          {step === 'app2' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                O Baiu avisa antes de o dinheiro escapar
              </T>
              <T variant="body" tone="ink2">
                Ele aprende o seu normal e chama quando um gasto passa do ponto ou quando uma conta está para vencer.
              </T>
              <MockAvisos />
            </>
          ) : null}

          {step === 'origem' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                Como você conheceu o Baiu?
              </T>
              <T variant="body" tone="ink2">
                Ajuda a gente a chegar em mais gente como você.
              </T>
              <Options options={ORIGENS} value={origem} onChange={setOrigem} compact />
            </>
          ) : null}

          {step === 'escape' ? (
            <>
              <T variant="title2" accessibilityRole="header">
                {`Quanto escapa ${dono} por mês sem você perceber?`}
              </T>
              <T variant="callout" tone="ink2">
                Assinatura esquecida, delivery por impulso, tarifa do banco, juros do cartão, aquele Pix que você nem
                lembra.
              </T>
              <View style={styles.reading}>
                <T variant="display" tabular style={styles.number} numberOfLines={1} adjustsFontSizeToFit>
                  {reais(escape)}
                </T>
                <T variant="title3" tone="ink2">
                  por mês
                </T>
              </View>
              <Slider
                value={escape}
                min={range.min}
                max={range.max}
                step={range.step}
                onChange={setEscape}
                label="Quanto escapa por mês"
                spoken={(v) => `${reais(v)} por mês`}
              />
              <T variant="caption" tone="ink3">
                Só em assinaturas, a média no Brasil é R$ 118 por mês (Bango, 2024). Chute sem medo: quase ninguém sabe
                ao certo, e esse é justamente o problema.
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
              <T variant="caption" tone="ink3">
                Suas respostas não saem deste aparelho.
              </T>
            </>
          ) : null}

          {step === 'conta' ? (
            <>
              <T variant="body" tone="ink2">
                {`Se nada mudar, até os ${p.untilAge} anos vão escapar ${dono}`}
              </T>
              <CountUp value={p.total} format={reais} spoken={reais(p.total)} />
              <T variant="title2">{`São ${reais(escape * 12)} por ano, durante ${p.years} anos.`}</T>
              <T variant="callout" tone="ink2">
                Dinheiro que sai aos poucos, sem barulho, e que você nunca vê junto.
              </T>
              <Source>
                {`A conta vai até a expectativa de vida do brasileiro, 76,6 anos (${REF.expectativaVida.source}), sem juros nem inflação.`}
              </Source>
            </>
          ) : null}

          {step === 'coisas' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                {`${reais(p.total)} é o mesmo que…`}
              </T>
              <View style={styles.things}>
                {(
                  [
                    [p.salarios, p.salarios === 1 ? 'salário mínimo inteiro' : 'salários mínimos inteiros'],
                    [p.cestas, p.cestas === 1 ? 'mês de cesta básica' : 'meses de cesta básica'],
                    [
                      p.anosAssinaturas,
                      p.anosAssinaturas === 1
                        ? 'ano com todas as assinaturas de uma pessoa'
                        : 'anos com todas as assinaturas de uma pessoa',
                    ],
                  ] as [number, string][]
                )
                  .filter(([n]) => n > 0)
                  .map(([n, label], i) => (
                    <Animated.View key={label} entering={FadeIn.delay(200 + i * 220).duration(400)} style={styles.thing}>
                      <T variant="hero" tone="lantern" tabular>
                        {count(n)}
                      </T>
                      <T variant="callout" style={{ flex: 1 }}>
                        {label}
                      </T>
                    </Animated.View>
                  ))}
              </View>
              <Source>
                {`Salário mínimo de R$ 1.621 (${REF.salarioMinimo.source}); cesta básica de R$ 915,01 (${REF.cestaBasica.source}); R$ 1.416 por ano em assinaturas (${REF.assinaturasAno.source}).`}
              </Source>
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
              <Source>{`Simulação com ${REF.poupancaMes.source}, e sem inflação.`}</Source>
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
                {`Foram R$ 515,4 bilhões só no primeiro semestre de 2026. E, pela sua conta, escapam ${brl(escape / 30)} ${dono} por dia.`}
              </T>
              <Source>{`${JUROS_FAMILIAS.source}.`}</Source>
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

          {step === 'ajuda' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                O Baiu acende a luz
              </T>
              <T variant="body" tone="ink2">
                Para o dinheiro parar de escapar, primeiro você precisa ver para onde ele vai.
              </T>
              <View style={styles.promises}>
                {PROMESSAS.map((t, i) => (
                  <Animated.View key={t} entering={FadeIn.delay(250 + i * 180).duration(400)} style={styles.promise}>
                    <Mark state="cheia" size={20} />
                    <T variant="callout" style={{ flex: 1 }}>
                      {t}
                    </T>
                  </Animated.View>
                ))}
              </View>
            </>
          ) : null}

          {step === 'objetivo' ? (
            <>
              <T variant="title1" accessibilityRole="header">
                O que você faria com esse dinheiro?
              </T>
              <Options options={OBJETIVOS} value={objetivo} onChange={setObjetivo} grid />
              {objetivo ? <Plano monthly={escape * PARTE_SEGURADA} objetivo={objetivo} /> : null}
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
                <T variant="callout" tone="lantern">{`Cada mês que passa, escapam ${reais(escape)} ${dono}.`}</T>
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

/** Um dado com fonte: número grande, frase e de onde veio. */
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
      <Source>{`Fonte: ${stat.source}`}</Source>
    </View>
  );
}

function Source({ children }: { children: string }) {
  return (
    <T variant="micro" tone="ink3" style={{ marginTop: 4 }}>
      {children}
    </T>
  );
}

/** Simulação do objetivo: segurar parte do que escapa, guardado na poupança. */
function Plano({ monthly, objetivo }: { monthly: number; objetivo: Objetivo }) {
  const o = OBJETIVOS.find((x) => x.value === objetivo)!;
  const ano = savingsValue(monthly, 12);
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.plan}>
      <T variant="callout" tone="ink2">
        {`Segurando metade do que escapa, ${reais(monthly)} por mês, em 1 ano você junta`}
      </T>
      <T variant="hero" tone="lantern" tabular>
        {reais(ano)}
      </T>
      <T variant="callout">{`para ${o.para}. Em 5 anos, ${reais(savingsValue(monthly, 60))}.`}</T>
      <Source>{`Simulação com ${REF.poupancaMes.source}. Quanto você segura depende de você; o Baiu mostra para onde o dinheiro vai.`}</Source>
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
      <T variant="micro" tone="ink3" align="center" style={{ marginTop: 6 }}>
        Exemplo ilustrativo
      </T>
    </View>
  );
}

/** Como chegam os avisos do Baiu, com valores de exemplo. */
function MockAvisos() {
  const avisos: { icon: IconName; title: string; text: string; tint: string }[] = [
    {
      icon: 'bell',
      title: 'Delivery fora do normal',
      text: 'Este mês já foram R$ 412, o dobro do seu normal.',
      tint: color.vermilion,
    },
    { icon: 'calendar', title: 'Conta de luz vence amanhã', text: 'R$ 238,40, no dia 10.', tint: color.lantern },
  ];
  return (
    <View style={{ gap: 10 }} accessible accessibilityLabel="Exemplo de avisos: um gasto fora do normal e uma conta para vencer">
      {avisos.map((a, i) => (
        <Animated.View key={a.title} entering={FadeInDown.delay(300 + i * 260).duration(400)} style={styles.notice}>
          <View style={[styles.optionIcon, { backgroundColor: color.plateHi }]}>
            <Icon name={a.icon} size={18} tint={a.tint} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="captionStrong" tone="ink2">
              BAIU
            </T>
            <T variant="calloutStrong">{a.title}</T>
            <T variant="caption" tone="ink2">
              {a.text}
            </T>
          </View>
        </Animated.View>
      ))}
      <View style={[styles.notice, { alignItems: 'center' }]}>
        <Baiu score={72} width={64} still halo={false} />
        <View style={{ flex: 1 }}>
          <T variant="calloutStrong">Fôlego 72</T>
          <T variant="caption" tone="ink2">
            O dinheiro está respirando.
          </T>
        </View>
      </View>
      <T variant="micro" tone="ink3" align="center">
        Exemplo ilustrativo
      </T>
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
  promises: { gap: 14, marginTop: 6 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  notice: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.plate,
  },
});
