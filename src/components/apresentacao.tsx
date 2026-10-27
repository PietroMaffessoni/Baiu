import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LEAK_YEARS, LEAKS, STATS } from '@/content/apresentacao';
import { brl } from '@/lib/money';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';
import { Baiu, baiuHeight } from './baiu/baiu';
import { Button, IconButton } from './button';
import { Chips } from './form';
import { GroundLight } from './ground-light';
import { Mark } from './mark';
import { BigMoney } from './money';

/** Fôlego do Baiu na tela "E no seu bolso?" e no fim, quando ele enche. */
const LEAK_SCORE = 8;
const FINAL_SCORE = 92;
const STEPS = STATS.length + 2;

const PROMISES = [
  'Conecte até 3 bancos e veja cada entrada e saída organizada sozinha.',
  'O Baiu reconhece as contas que se repetem e avisa quando um gasto foge do normal.',
  'Seu fôlego, uma nota de 0 a 100, mostra se o dinheiro está respirando.',
];

/**
 * Apresentação do primeiro uso: os números do dinheiro no Brasil, um a um,
 * com fonte. O Baiu murcha a cada dado; na conta "E no seu bolso?" a pessoa
 * vê quanto escapa em 10 anos; no fim, o Baiu enche e mostra como ajuda.
 */
export function Apresentacao({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [leak, setLeak] = useState(100);
  const stat = step < STATS.length ? STATS[step] : null;
  const final = step === STEPS - 1;
  const score = stat ? stat.score : final ? FINAL_SCORE : LEAK_SCORE;

  // o Baiu estufa ao chegar no fim
  useEffect(() => {
    if (final && Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [final]);

  const next = () => (final ? onDone() : setStep((s) => s + 1));

  // em telas baixas o Baiu encolhe para o texto caber
  const avail = height - insets.top - insets.bottom;
  const fishW = Math.min(180, Math.round(width * 0.46), Math.round(avail * 0.2));
  const fishH = baiuHeight(fishW);
  const top = insets.top + 8;

  return (
    <View style={styles.screen}>
      <GroundLight
        width={width}
        height={height * 0.7}
        cx={width / 2}
        cy={top + 60 + fishH * 0.56}
        intensity={0.15 + (score / 100) * 0.85}
      />
      <View style={[styles.bar, { paddingTop: top }]}>
        {step > 0 ? (
          <IconButton icon="back" label="Voltar" onPress={() => setStep((s) => s - 1)} />
        ) : (
          <View style={{ width: 44 }} />
        )}
        <View
          style={styles.progress}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Passo ${step + 1} de ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.segment, i <= step && styles.segmentOn]} />
          ))}
        </View>
        {final ? (
          <View style={{ width: 44 }} />
        ) : (
          <Pressable onPress={onDone} accessibilityRole="button" hitSlop={10} style={styles.skip}>
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
        <View style={{ height: fishH * 0.96, alignItems: 'center' }}>
          <Baiu score={score} width={fishW} />
        </View>

        <Animated.View key={step} entering={FadeInDown.duration(450)} style={styles.body}>
          {stat ? (
            <>
              <CountUp value={stat.value} format={stat.format} spoken={stat.spoken} />
              <T variant="title2">{stat.title}</T>
              <T variant="body" tone="ink2">
                {stat.detail}
              </T>
              <T variant="micro" tone="ink3" style={{ marginTop: 6 }}>
                {`Fonte: ${stat.source}`}
              </T>
            </>
          ) : null}

          {step === STATS.length ? (
            <>
              <T variant="title1">E no seu bolso?</T>
              <T variant="body" tone="ink2">
                Assinatura esquecida, tarifa do banco, juros do cartão, delivery por impulso. Quanto escapa por mês sem
                você perceber?
              </T>
              <Chips
                options={LEAKS.map((v) => ({ value: v, label: brl(v, { cents: false }) }))}
                value={leak}
                onChange={setLeak}
              />
              <View style={styles.result}>
                <BigMoney
                  value={leak * 12 * LEAK_YEARS}
                  size={46}
                  accessibilityLabel={`${brl(leak * 12 * LEAK_YEARS, { cents: false })} em ${LEAK_YEARS} anos`}
                />
                <T variant="title3">{`em ${LEAK_YEARS} anos`}</T>
              </View>
              <T variant="callout" tone="ink2">
                {`É o que ${brl(leak, { cents: false })} por mês somam em ${LEAK_YEARS} anos, sem contar os juros. Dinheiro que dava uma viagem, uma reserva ou o fim de uma dívida.`}
              </T>
            </>
          ) : null}

          {final ? (
            <>
              <T variant="title1">O Baiu acende a luz</T>
              <T variant="body" tone="ink2">
                Para o dinheiro parar de escapar, primeiro você precisa ver para onde ele vai.
              </T>
              <View style={styles.promises}>
                {PROMISES.map((p, i) => (
                  <Animated.View key={p} entering={FadeIn.delay(250 + i * 180).duration(400)} style={styles.promise}>
                    <Mark state="cheia" size={20} />
                    <T variant="callout" style={{ flex: 1 }}>
                      {p}
                    </T>
                  </Animated.View>
                ))}
              </View>
            </>
          ) : null}
        </Animated.View>

        <View style={{ flex: 1, minHeight: 24 }} />
        <Button label={final ? 'Começar' : 'Continuar'} onPress={next} />
      </ScrollView>
    </View>
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
      const t = Math.min(1, (Date.now() - start) / 1100);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return (
    <T variant="display" tabular accessibilityLabel={spoken} style={styles.number}>
      {format(reduce ? value : shown)}
    </T>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: gutter, paddingBottom: 8 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.plateHi },
  segmentOn: { backgroundColor: color.lantern },
  skip: { minWidth: 44, alignItems: 'flex-end' },
  content: { flexGrow: 1, paddingHorizontal: gutter, paddingTop: 12 },
  body: { gap: 12, marginTop: 8 },
  number: { fontSize: 56, lineHeight: 66 },
  result: { alignItems: 'flex-start', gap: 2, marginTop: 4 },
  promises: { gap: 14, marginTop: 6 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
