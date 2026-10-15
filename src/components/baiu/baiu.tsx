import * as Haptics from 'expo-haptics';
import { useEffect, useId, useState } from 'react';
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
import { paletteFor, type BaiuColor, type Season } from '@/lib/look';
import { BaiuBody, BaiuEyes, BaiuFin, Halo } from './art';
import { CX, geom, VB_H, VB_W } from './geometry';
import { useBaiuLook } from './use-look';

type Props = {
  /** Fôlego de 0 a 100. Define humor e tamanho. */
  score: number;
  /** Largura da caixa de desenho em px. */
  width?: number;
  /** Sem animação (miniaturas, legenda). */
  still?: boolean;
  /** Força um humor (legenda da escala). */
  mood?: Mood;
  interactive?: boolean;
  /** Mostra a luz suave atrás do Baiu. */
  halo?: boolean;
  /** Força uma cor (prévia da personalização). */
  color?: BaiuColor;
  /** Força um enfeite; null tira o enfeite da data. */
  season?: Season | null;
};

const FIN_SPEED: Record<Mood, number> = { estufado: 520, cheio: 700, meio: 950, murcho: 1500 };

/** O tamanho do Baiu é a leitura direta do fôlego. */
export function levelScale(score: number) {
  return 0.8 + 0.2 * Math.min(1, Math.max(0, score / 100));
}

/** Altura da caixa de desenho para uma largura. */
export const baiuHeight = (width: number) => (width * VB_H) / VB_W;

export function Baiu({
  score,
  width = 180,
  still,
  mood: forced,
  interactive = false,
  halo = true,
  color: forcedColor,
  season: forcedSeason,
}: Props) {
  const mood = forced ?? moodOf(score).mood;
  const look = useBaiuLook();
  const tint = forcedColor ?? look.color;
  const season = forcedSeason === undefined ? look.season : forcedSeason;
  const reduce = useReducedMotion();
  const animate = !still && !reduce;
  const [puffed, setPuffed] = useState(false);

  const f = width / VB_W;
  const H = baiuHeight(width);
  const g = geom(mood);
  const pal = paletteFor(tint, mood);
  // id único por Baiu: na web, dois desenhos na mesma página não podem dividir o degradê
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `baiu-${uid}-${tint}-${mood}`;
  const haloSize = width * 2;
  const bodyCenterY = g.cy * f;

  const level = useSharedValue(levelScale(score));
  const bob = useSharedValue(0);
  const puff = useSharedValue(0);
  const finL = useSharedValue(0);
  const finR = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    level.set(still ? levelScale(score) : withSpring(levelScale(score), { damping: 9, stiffness: 70 }));
  }, [score, still, level]);

  useEffect(() => {
    if (!animate) {
      bob.set(0);
      finL.set(0);
      finR.set(0);
      blink.set(1);
      return;
    }
    const sine = Easing.inOut(Easing.sin);
    // boia devagar, como peixe parado na água; murcho mal se mexe
    bob.set(
      withSequence(
        withTiming(-1, { duration: 1500, easing: sine }),
        withRepeat(withTiming(1, { duration: mood === 'murcho' ? 4200 : 3000, easing: sine }), -1, true),
      ),
    );
    const speed = FIN_SPEED[mood];
    finL.set(withRepeat(withTiming(1, { duration: speed, easing: sine }), -1, true));
    finR.set(withDelay(speed * 0.4, withRepeat(withTiming(1, { duration: speed, easing: sine }), -1, true)));
    blink.set(
      withRepeat(
        withSequence(withDelay(3600, withTiming(0.08, { duration: 80 })), withTiming(1, { duration: 130 })),
        -1,
        false,
      ),
    );
    return () => {
      [bob, finL, finR, blink].forEach(cancelAnimation);
    };
  }, [animate, mood, bob, finL, finR, blink]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.get() * H * 0.025 }, { rotate: `${bob.get() * 1.6}deg` }],
  }));

  const bodyStyle = useAnimatedStyle(() => {
    const s = level.get() * (1 + 0.1 * puff.get());
    const p = bodyCenterY - H / 2;
    return { transform: [{ translateY: p }, { scale: s }, { translateY: -p }] };
  });

  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pal.glow * 0.9 + puff.get() * 0.5),
    transform: [{ scale: level.get() * (1 + 0.18 * puff.get()) }],
  }));

  const finLStyle = useAnimatedStyle(() => {
    const deg = -10 + finL.get() * 24 + puff.get() * 14;
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
    const deg = -(-10 + finR.get() * 24 + puff.get() * 14);
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
    return { transform: [{ translateY: p }, { scaleY: puff.get() > 0.5 ? 1 : blink.get() }, { translateY: -p }] };
  });

  const onIn = () => {
    setPuffed(true);
    puff.set(withSpring(1, { damping: 7, stiffness: 180 }));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  const onOut = () => {
    setPuffed(false);
    puff.set(withSpring(0, { damping: 10, stiffness: 120 }));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const label = `Baiu, ${moodOf(score).label.toLowerCase()}. Fôlego ${score}.`;

  const fish = (
    <Animated.View style={[styles.abs, { width, height: H }, bodyStyle]}>
      <Animated.View style={[styles.abs, finLStyle]}>
        <BaiuFin mood={mood} width={width} side={-1} pal={pal} />
      </Animated.View>
      <Animated.View style={[styles.abs, finRStyle]}>
        <BaiuFin mood={mood} width={width} side={1} pal={pal} />
      </Animated.View>
      <View style={styles.abs}>
        <BaiuBody mood={mood} width={width} pal={pal} id={id} puffed={puffed} season={season} />
      </View>
      <Animated.View style={[styles.abs, eyeStyle]}>
        <BaiuEyes mood={mood} width={width} puffed={puffed} />
      </Animated.View>
    </Animated.View>
  );

  return (
    <Animated.View style={[{ width, height: H }, floatStyle]}>
      {halo && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.abs,
            { width: haloSize, height: haloSize, left: (width - haloSize) / 2, top: bodyCenterY - haloSize / 2 },
            haloStyle,
          ]}>
          <Halo size={haloSize} tint={pal.glowColor} id={id} />
        </Animated.View>
      )}
      {interactive ? (
        <Pressable
          onPressIn={onIn}
          onPressOut={onOut}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Segure para o Baiu estufar"
          style={[styles.abs, { width, height: H }]}>
          {fish}
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          style={[styles.abs, { width, height: H }]}>
          {fish}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});
