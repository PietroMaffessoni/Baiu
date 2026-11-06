import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createDemo } from '@/data/demo';
import { computeFolego } from '@/lib/folego';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';
import { Baiu, baiuHeight } from './baiu/baiu';
import { Button, IconButton } from './button';
import { Mark } from './mark';
import { Wordmark } from './wordmark';

/** Fôlegos por onde o Baiu passa enquanto a pessoa decide. */
const BREATH = [8, 34, 64, 34];

/**
 * Primeiro contato: o Baiu respira, enchendo e murchando, como faz com o
 * dinheiro. "Começar" leva ao caminho do primeiro uso; dá também para entrar
 * na conta que já existe ou explorar os dados de exemplo. Ao explorar, o Baiu
 * enche até o fôlego do exemplo antes de o app abrir.
 *
 * Revendo pelos Ajustes (`onClose`), só "Começar" anda; os outros dois botões
 * aparecem como são, sem fazer nada.
 */
export function Welcome({
  onStart,
  onSignIn,
  onExplore,
  onClose,
}: {
  onStart: () => void;
  onSignIn?: () => void;
  onExplore?: () => void;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [score, setScore] = useState(8);
  const [filling, setFilling] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const reduce = useReducedMotion();

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // o Baiu respira até a pessoa escolher; com Reduzir Movimento, fica parado
  useEffect(() => {
    if (reduce || filling) return;
    let i = 0;
    const id = setInterval(() => setScore(BREATH[++i % BREATH.length]), 1600);
    return () => clearInterval(id);
  }, [reduce, filling]);

  const explore = () => {
    if (filling || !onExplore) return;
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
    timers.current.push(setTimeout(onExplore, 260 + steps.length * 380 + 650));
  };

  // em telas baixas o Baiu encolhe para os três botões caberem
  const avail = height - insets.top - insets.bottom;
  const fishW = Math.min(270, Math.round(width * 0.66), Math.round(avail * 0.3));
  const fishTop = insets.top + 6;
  const fishH = baiuHeight(fishW);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
      <View style={{ height: fishTop + fishH * 0.96, paddingTop: fishTop, alignItems: 'center' }}>
        <Baiu score={score} width={fishW} />
      </View>
      {onClose ? (
        <View style={[styles.close, { top: insets.top + 8 }]}>
          <IconButton icon="close" label="Fechar" onPress={onClose} />
        </View>
      ) : null}

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
          <Button label="Começar" onPress={onStart} disabled={filling} />
          <Pressable
            onPress={onSignIn}
            disabled={filling}
            accessibilityRole="button"
            accessibilityLabel="Já tenho conta"
            style={styles.signIn}>
            <T variant="callout" tone="ink2">
              Já tem uma conta?{' '}
              <T variant="calloutStrong" tone="lantern">
                Entrar
              </T>
            </T>
          </Pressable>
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
  close: { position: 'absolute', left: gutter },
  body: { flex: 1, paddingHorizontal: gutter, paddingTop: 8 },
  points: { marginTop: 20, gap: 10 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  signIn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
