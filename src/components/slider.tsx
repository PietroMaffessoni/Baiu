import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent, type ViewInstance } from 'react-native';

import { color } from '@/theme/tokens';

const THUMB = 30;

type Props = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** Nome da régua para leitor de tela. */
  label: string;
  /** Como o valor é lido ("R$ 150 por mês"). */
  spoken: (v: number) => string;
};

/**
 * Régua de arrastar. Com leitor de tela, desliza de passo em passo
 * (accessibilityRole "adjustable"); no teclado da web, as setas também.
 */
export function Slider({ value, min, max, step, onChange, label, spoken }: Props) {
  const track = useRef<ViewInstance>(null);
  const box = useRef({ x: 0, width: 1 });
  const [width, setWidth] = useState(0);
  // último valor enviado durante o arraste, para não repetir a vibração
  const last = useRef(value);

  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
    if (next === last.current) return;
    last.current = next;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  const fromX = (pageX: number) => {
    const usable = Math.max(1, box.current.width - THUMB);
    const t = Math.min(1, Math.max(0, (pageX - box.current.x - THUMB / 2) / usable));
    set(min + t * (max - min));
  };

  const grant = (e: GestureResponderEvent) => {
    const x0 = e.nativeEvent.pageX;
    last.current = value;
    track.current?.measureInWindow((x, _y, w) => {
      box.current = { x, width: w };
      fromX(x0);
    });
  };

  const t = (value - min) / (max - min);
  const left = t * Math.max(0, width - THUMB);
  const adjust = (dir: 1 | -1) => set(value + dir * step);

  return (
    <View
      ref={track}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.track}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: spoken(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => adjust(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      focusable
      // web: setas do teclado
      {...(Platform.OS === 'web'
        ? {
            onKeyDown: (e: { nativeEvent: { key: string } }) => {
              const k = e.nativeEvent.key;
              if (k === 'ArrowRight' || k === 'ArrowUp') adjust(1);
              if (k === 'ArrowLeft' || k === 'ArrowDown') adjust(-1);
            },
          }
        : null)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // dentro de uma ScrollView, o arraste fica com a régua
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={(e) => fromX(e.nativeEvent.pageX)}>
      <View style={styles.rail} pointerEvents="none">
        <View style={[styles.fill, { width: left }]} />
      </View>
      <View style={[styles.thumb, { left }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 44, justifyContent: 'center' },
  rail: {
    height: 8,
    borderRadius: 4,
    backgroundColor: color.plateHi,
    marginHorizontal: THUMB / 2,
    overflow: 'hidden',
  },
  fill: { height: 8, backgroundColor: color.lantern },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: color.lanternCore,
    borderWidth: 3,
    borderColor: color.lantern,
  },
});
