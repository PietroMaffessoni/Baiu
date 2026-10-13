import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { VB_W } from '@/components/baiu/geometry';
import { Button } from '@/components/button';
import { GroundLight } from '@/components/ground-light';
import { Mark } from '@/components/mark';
import { Wordmark } from '@/components/wordmark';
import { createDemo } from '@/data/demo';
import { computeFolego } from '@/lib/folego';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

/**
 * Primeiro contato: o Baiu começa murcho. Ao tocar em Começar, ele enche até o
 * fôlego inicial (ou o dos dados de exemplo), e só então o app abre.
 */
export default function BoasVindas() {
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [score, setScore] = useState(8);
  const [filling, setFilling] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasData = state.accounts.length > 0 && !state.demo;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = (mode: 'real' | 'demo') => {
    if (filling) return;
    setFilling(true);
    const target = computeFolego(mode === 'demo' ? createDemo() : state).score;
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
    timers.current.push(
      setTimeout(() => dispatch({ type: mode === 'demo' ? 'loadDemo' : 'onboard' }), 260 + steps.length * 380 + 650),
    );
  };

  const lanternW = Math.min(270, Math.round(width * 0.64));
  const cord = insets.top + Math.max(18, height * 0.03);
  const lanternH = (lanternW * 240) / VB_W;

  return (
    <View style={styles.screen}>
      <GroundLight
        width={width}
        height={height * 0.8}
        cx={width / 2}
        cy={cord + lanternH * 0.4}
        intensity={filling ? 1 : 0.25}
      />
      <View style={{ height: cord + lanternH * 0.9, alignItems: 'center' }}>
        <Baiu score={score} width={lanternW} cord={cord} />
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + 18 }]}>
        <Animated.View entering={FadeIn.duration(500)}>
          <Wordmark width={104} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(500)}>
          <T variant="hero" style={{ marginTop: 18 }}>
            Cuide do seu dinheiro.{'\n'}O Baiu enche junto.
          </T>
          <T variant="body" tone="ink2" style={{ marginTop: 12, maxWidth: 360 }}>
            Reúna suas contas, acompanhe gastos e investimentos e veja o Baiu ganhar fôlego a cada bom hábito.
          </T>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.points}>
          {[
            'Todas as suas contas num lugar só',
            'Para onde o dinheiro foi, dia a dia',
            'Um selo para cada bom hábito',
          ].map((t) => (
            <View key={t} style={styles.point}>
              <Mark state="cheia" size={20} />
              <T variant="callout">{t}</T>
            </View>
          ))}
        </Animated.View>
        <View style={{ flex: 1, minHeight: 20 }} />
        <Animated.View entering={FadeInDown.delay(260).duration(500)} style={{ gap: 4 }}>
          <Button label={filling ? 'Enchendo o Baiu…' : 'Começar'} onPress={() => start('real')} />
          {!hasData && <Button label="Explorar com dados de exemplo" kind="quiet" onPress={() => start('demo')} />}
          <T variant="caption" tone="ink3" align="center" style={{ marginTop: 4 }}>
            Seus dados ficam só neste aparelho, protegidos por criptografia.
          </T>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  body: { flex: 1, paddingHorizontal: gutter, paddingTop: 8 },
  points: { marginTop: 24, gap: 12 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
