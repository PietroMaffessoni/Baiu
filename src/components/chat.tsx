import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { ChatMsg } from '@/data/types';
import { AI_ENABLED } from '@/lib/assistant/remote';
import { maskValues } from '@/lib/assistant/text';
import { T } from '@/theme/text';
import { color, radius } from '@/theme/tokens';
import { Baiu } from './baiu/baiu';
import { Icon, type IconName } from './icon';

/** O Baiu pequeno, ao lado das falas dele. */
export function BaiuAvatar({ score, size = 34 }: { score: number; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Baiu score={score} width={size * 1.15} still halo={false} />
    </View>
  );
}

type BubbleProps = {
  msg: Pick<ChatMsg, 'role' | 'text' | 'source' | 'ask' | 'bill'>;
  score: number;
  hide?: boolean;
  /** Mostra o Baiu ao lado (primeira fala de uma sequência). */
  avatar?: boolean;
  onAsk?: (q: string) => void;
  onBill?: (b: NonNullable<ChatMsg['bill']>) => void;
  disabled?: boolean;
};

export function Bubble({ msg, score, hide, avatar = true, onAsk, onBill, disabled }: BubbleProps) {
  const text = hide ? maskValues(msg.text) : msg.text;
  if (msg.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={[styles.bubble, styles.user]}>
          <T variant="body" selectable>
            {text}
          </T>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.baiuRow}>
      <View style={styles.avatarSlot}>{avatar ? <BaiuAvatar score={score} /> : null}</View>
      <View style={{ flex: 1, alignItems: 'flex-start', gap: 8 }}>
        <View style={[styles.bubble, styles.baiu, msg.source === 'aviso' && styles.notice]}>
          {msg.source === 'aviso' ? (
            <T variant="captionStrong" tone="lantern" style={{ marginBottom: 2 }}>
              O Baiu notou
            </T>
          ) : null}
          <T variant="body" selectable>
            {text}
          </T>
          {AI_ENABLED && msg.source === 'pronta' ? (
            <T variant="micro" tone="ink3" style={{ marginTop: 6 }}>
              Resposta pronta, sem IA
            </T>
          ) : null}
        </View>
        {msg.ask || msg.bill ? (
          <View style={styles.actions}>
            {msg.bill && onBill ? (
              <ActionChip icon="bell" label="Criar lembrete" onPress={() => onBill(msg.bill!)} disabled={disabled} />
            ) : null}
            {msg.ask && onAsk ? (
              <ActionChip icon="chat" label={msg.ask} onPress={() => onAsk(msg.ask!)} disabled={disabled} />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function ActionChip({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        pressed && { backgroundColor: color.plateHi },
        disabled && { opacity: 0.5 },
      ]}>
      {icon ? <Icon name={icon} size={15} tint={color.lantern} /> : null}
      <T variant="calloutStrong" tone="lantern" numberOfLines={2} style={{ flexShrink: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

function Dot({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(0.35);
  useEffect(() => {
    if (reduce) return;
    v.set(
      withDelay(
        delay,
        withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.35, { duration: 320 })), -1),
      ),
    );
  }, [delay, reduce, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.get() }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** O Baiu pensando. */
export function Typing({ score }: { score: number }) {
  return (
    <View style={styles.baiuRow} accessible accessibilityLabel="O Baiu está escrevendo">
      <View style={styles.avatarSlot}>
        <BaiuAvatar score={score} />
      </View>
      <View style={[styles.bubble, styles.baiu, styles.typing]}>
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </View>
    </View>
  );
}

/** O resumo enviado à IA, em frases. */
export function ContextPreview({ sections, hide }: { sections: { title: string; lines: string[] }[]; hide?: boolean }) {
  const mask = (s: string) => (hide ? s.replace(/R\$ [\d.,]+/g, 'R$ ••••') : s);
  return (
    <View style={styles.preview}>
      {sections.map((s) => (
        <View key={s.title} style={{ gap: 2 }}>
          <T variant="captionStrong" tone="ink2">
            {s.title}
          </T>
          {s.lines.map((l) => (
            <T key={l} variant="caption" tone="ink3" tabular>
              {mask(l)}
            </T>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingLeft: 48 },
  baiuRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 24 },
  avatarSlot: { width: 34, paddingTop: 2 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    maxWidth: '100%',
  },
  user: {
    backgroundColor: color.plateHi,
    borderBottomRightRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  baiu: {
    backgroundColor: color.plate,
    borderTopLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  notice: { borderColor: 'rgba(255, 182, 72, 0.35)' },
  actions: { gap: 8, alignItems: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  typing: { flexDirection: 'row', gap: 6, paddingVertical: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.ink2 },
  preview: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: color.nightDeep },
});
