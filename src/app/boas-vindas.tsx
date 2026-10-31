import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Apresentacao } from '@/components/apresentacao';
import { Baiu, baiuHeight } from '@/components/baiu/baiu';
import { Button } from '@/components/button';
import { GroundLight } from '@/components/ground-light';
import { Mark } from '@/components/mark';
import { Wordmark } from '@/components/wordmark';
import { createDemo } from '@/data/demo';
import { computeFolego } from '@/lib/folego';
import { introSeen, markIntroSeen } from '@/lib/intro';
import { useAuth } from '@/store/auth';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

/**
 * Primeiro contato: o Baiu começa murcho. Daqui a pessoa cria a conta, entra
 * na que já tem ou explora os dados de exemplo, a única parte do app sem conta.
 * Ao explorar, o Baiu enche até o fôlego do exemplo antes de o app abrir.
 * No primeiro uso do aparelho, antes disso, vem a apresentação com os números
 * do dinheiro no Brasil.
 */
export default function BoasVindas() {
  const { enterDemo } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [score, setScore] = useState(8);
  const [filling, setFilling] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // null: ainda lendo se a apresentação já foi vista neste aparelho
  const [intro, setIntro] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    introSeen().then((seen) => alive && setIntro(!seen));
    return () => {
      alive = false;
    };
  }, []);

  const explore = () => {
    if (filling) return;
    setFilling(true);
    const target = computeFolego(createDemo()).score;
    const steps = (target > 52 ? [30, 52, target] : [Math.max(12, target - 10), target]).filter((v) => v > 8);
    steps.forEach((v, i) => {
      timers.current.push(
        setTimeout(
          () => {
            setScore(v);
            if (Platform.OS !== 'web')
              Haptics.impactAsync(
                i === steps.length - 1 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
              ).catch(() => {});
          },
          260 + i * 380,
        ),
      );
    });
    timers.current.push(setTimeout(enterDemo, 260 + steps.length * 380 + 650));
  };

  // em telas baixas o Baiu encolhe para os três botões caberem
  const avail = height - insets.top - insets.bottom;
  const fishW = Math.min(270, Math.round(width * 0.66), Math.round(avail * 0.3));
  const fishTop = insets.top + 6;
  const fishH = baiuHeight(fishW);

  if (intro === null) return <View style={styles.screen} />;
  if (intro)
    return (
      <Apresentacao
        onDone={() => {
          markIntroSeen();
          setIntro(false);
        }}
      />
    );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
      <GroundLight
        width={width}
        height={height * 0.8}
        cx={width / 2}
        cy={fishTop + fishH * 0.56}
        intensity={filling ? 1 : 0.25}
      />
      <View style={{ height: fishTop + fishH * 0.96, paddingTop: fishTop, alignItems: 'center' }}>
        <Baiu score={score} width={fishW} />
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + 18 }]}>
        <Animated.View entering={FadeIn.duration(500)}>
          <Wordmark width={104} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(500)}>
          <T variant="hero" style={{ marginTop: 18 }}>
            Cuide do seu dinheiro.{'\n'}O Baiu enche junto.
          </T>
          {avail >= 680 ? (
            <T variant="body" tone="ink2" style={{ marginTop: 12, maxWidth: 360 }}>
              Reúna suas contas, converse com o Baiu sobre seu dinheiro e veja ele ganhar fôlego a cada bom hábito.
            </T>
          ) : null}
        </Animated.View>
        {avail >= 760 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.points}>
            {[
              'Todas as suas contas num lugar só',
              'O Baiu avisa quando um gasto foge do normal',
              'Um selo para cada bom hábito',
            ].map((t) => (
              <View key={t} style={styles.point}>
                <Mark state="cheia" size={20} />
                <T variant="callout">{t}</T>
              </View>
            ))}
          </Animated.View>
        ) : null}
        <View style={{ flex: 1, minHeight: 20 }} />
        <Animated.View entering={FadeInDown.delay(260).duration(500)} style={{ gap: 8 }}>
          <Button label="Criar conta" onPress={() => router.push('/cadastro')} disabled={filling} />
          <Button label="Já tenho conta" kind="secondary" onPress={() => router.push('/entrar')} disabled={filling} />
          <Button
            label={filling ? 'Enchendo o Baiu…' : 'Explorar com dados de exemplo'}
            kind="quiet"
            onPress={explore}
          />
          <T variant="caption" tone="ink3" align="center" style={{ marginTop: 4 }}>
            Seus registros financeiros ficam só neste aparelho, protegidos por criptografia.
          </T>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  body: { flex: 1, paddingHorizontal: gutter, paddingTop: 8 },
  points: { marginTop: 20, gap: 10 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
