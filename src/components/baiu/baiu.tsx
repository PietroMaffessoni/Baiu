import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { moodOf, type Mood } from '@/lib/folego';
import { color } from '@/theme/tokens';
import { BaiuBody, BaiuEyes, BaiuFin, Halo } from './art';
import { CX, geom, PALETTE, TOP, VB_H, VB_W } from './geometry';

type Props = {
  /** Fôlego de 0 a 100. Define humor e tamanho. */
  score: number;
  /** Largura da caixa de desenho em px. */
  width?: number;
  /** Comprimento do fio acima da lanterna. 0 = sem fio. */
  cord?: number;
  /** Sem animação (miniaturas, legenda). */
  still?: boolean;
  /** Força um humor (legenda da escala). */
  mood?: Mood;
  interactive?: boolean;
  /** Mostra o halo de luz. */
  halo?: boolean;
};

const FIN_SPEED: Record<Mood, number> = { estufado: 520, cheio: 700, meio: 950, murcho: 1500 };

/** O tamanho do Baiu é a leitura direta do fôlego. */
export function levelScale(score: number) {
  return 0.8 + 0.2 * Math.min(1, Math.max(0, score / 100));
}

export function Baiu({ score, width = 180, cord = 0, still, mood: forced, interactive = false, halo = true }: Props) {
  const mood = forced ?? moodOf(score).mood;
  const reduce = useReducedMotion();
  const animate = !still && !reduce;
  const [puffed, setPuffed] = useState(false);

  const f = width / VB_W;
  const H = VB_H * f;
  const g = geom(mood);
  const pal = PALETTE[mood];
  const haloSize = width * 2.1;
  const bodyCenterY = cord + g.cy * f;
  const anchorY = (TOP - 10) * f;

  const level = useSharedValue(levelScale(score));
  const breath = useSharedValue(1);
  const puff = useSharedValue(0);
  const sway = useSharedValue(0);
  const finL = useSharedValue(0);
  const finR = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    level.value = still ? levelScale(score) : withSpring(levelScale(score), { damping: 9, stiffness: 70 });
  }, [score, still, level]);

  useEffect(() => {
    if (!animate) {
      breath.value = 1;
      sway.value = 0;
      finL.value = 0;
      finR.value = 0;
      blink.value = 1;
      return;
    }
    const sine = Easing.inOut(Easing.sin);
    breath.value = withRepeat(withTiming(1.022, { duration: 2400, easing: sine }), -1, true);
    sway.value = withSequence(
      withTiming(-1, { duration: 1800, easing: sine }),
      withRepeat(withTiming(1, { duration: 3600, easing: sine }), -1, true),
    );
    const speed = FIN_SPEED[mood];
    finL.value = withRepeat(withTiming(1, { duration: speed, easing: sine }), -1, true);
    finR.value = withDelay(speed * 0.4, withRepeat(withTiming(1, { duration: speed, easing: sine }), -1, true));
    blink.value = withRepeat(
      withSequence(withDelay(3600, withTiming(0.08, { duration: 80 })), withTiming(1, { duration: 130 })),
      -1,
      false,
    );
    return () => {
      [breath, sway, finL, finR, blink].forEach(cancelAnimation);
    };
  }, [animate, mood, breath, sway, finL, finR, blink]);

  const total = cord + H;

  const swayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -total / 2 }, { rotate: `${sway.value * 2.2}deg` }, { translateY: total / 2 }],
  }));

  const bodyStyle = useAnimatedStyle(() => {
    const s = level.value * breath.value * (1 + 0.1 * puff.value);
    const p = anchorY - H / 2;
    return { transform: [{ translateY: p }, { scale: s }, { translateY: -p }] };
  });

  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pal.glow * (0.85 + (breath.value - 1) * 6) + puff.value * 0.5),
    transform: [{ scale: level.value * (1 + 0.18 * puff.value) }],
  }));

  const finLStyle = useAnimatedStyle(() => {
    const deg = (-10 + finL.value * 24 + puff.value * 14) * 1;
    const px = (CX - g.finX) * f - width / 2;
    const py = g.finY * f - H / 2;
    return {
      transform: [
        { translateX: px },
        { translateY: py },
        { rotate: `${deg}deg` },
        { translateX: -px },
        { translateY: -py },
      ],
    };
  });
  const finRStyle = useAnimatedStyle(() => {
    const deg = (-10 + finR.value * 24 + puff.value * 14) * -1;
    const px = (CX + g.finX) * f - width / 2;
    const py = g.finY * f - H / 2;
    return {
      transform: [
        { translateX: px },
        { translateY: py },
        { rotate: `${deg}deg` },
        { translateX: -px },
        { translateY: -py },
      ],
    };
  });

  const eyeStyle = useAnimatedStyle(() => {
    const p = g.eyeY * f - H / 2;
    return { transform: [{ translateY: p }, { scaleY: puff.value > 0.5 ? 1 : blink.value }, { translateY: -p }] };
  });

  const onIn = () => {
    setPuffed(true);
    puff.value = withSpring(1, { damping: 7, stiffness: 180 });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  const onOut = () => {
    setPuffed(false);
    puff.value = withSpring(0, { damping: 10, stiffness: 120 });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const label = `Baiu, ${moodOf(score).label.toLowerCase()}. Fôlego ${score}.`;

  const lantern = (
    <Animated.View style={[styles.abs, { width, height: H }, bodyStyle]}>
      <Animated.View style={[styles.abs, finLStyle]}>
        <BaiuFin mood={mood} width={width} side={-1} />
      </Animated.View>
      <Animated.View style={[styles.abs, finRStyle]}>
        <BaiuFin mood={mood} width={width} side={1} />
      </Animated.View>
      <View style={styles.abs}>
        <BaiuBody mood={mood} width={width} puffed={puffed} />
      </View>
      <Animated.View style={[styles.abs, eyeStyle]}>
        <BaiuEyes mood={mood} width={width} puffed={puffed} />
      </Animated.View>
    </Animated.View>
  );

  return (
    <Animated.View style={[{ width, height: total }, swayStyle]}>
      {cord > 0 && <View style={[styles.cord, { left: width / 2 - 0.7, height: cord + 2 }]} />}
      {halo && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.abs,
            { width: haloSize, height: haloSize, left: (width - haloSize) / 2, top: bodyCenterY - haloSize / 2 },
            haloStyle,
          ]}>
          <Halo size={haloSize} />
        </Animated.View>
      )}
      {interactive ? (
        <Pressable
          onPressIn={onIn}
          onPressOut={onOut}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Segure para o Baiu estufar"
          style={[styles.abs, { top: cord, width, height: H }]}>
          {lantern}
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          style={[styles.abs, { top: cord, width, height: H }]}>
          {lantern}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  cord: { position: 'absolute', top: -2, width: 1.4, backgroundColor: color.paper, opacity: 0.45 },
});
