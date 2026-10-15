import { Pressable, StyleSheet, View } from 'react-native';

import type { Alert } from '@/lib/assistant/insights';
import { maskValues } from '@/lib/assistant/text';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';
import { Icon } from './icon';

/**
 * A fala do Baiu no Início, logo abaixo dele: o que ele notou nos gastos,
 * a apresentação para quem acabou de chegar ou só o convite para conversar.
 */
export function BaiuSays({
  alerts,
  greeted,
  firstName,
  hide,
  onOpen,
  onDismiss,
}: {
  alerts: Alert[];
  greeted: boolean;
  firstName?: string;
  hide: boolean;
  onOpen: () => void;
  onDismiss: (ids: string[]) => void;
}) {
  const top = alerts[0];

  if (!top && greeted) {
    return (
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="Conversar com o Baiu"
        style={({ pressed }) => [styles.pill, pressed && { backgroundColor: color.plateHi }]}>
        <Icon name="chat" size={16} tint={color.lantern} />
        <T variant="calloutStrong" tone="lantern">
          Conversar com o Baiu
        </T>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.tail} />
      <View style={styles.bubble}>
        {top ? (
          <>
            <T variant="captionStrong" tone="lantern">
              {alerts.length > 1 ? `O Baiu notou ${alerts.length} coisas` : 'O Baiu notou'}
            </T>
            <T variant="callout" style={{ marginTop: 4 }}>
              {hide ? maskValues(top.text) : top.text}
            </T>
          </>
        ) : (
          <>
            <T variant="captionStrong" tone="lantern">
              {`Oi${firstName ? `, ${firstName}` : ''}! Eu sou o Baiu.`}
            </T>
            <T variant="callout" style={{ marginTop: 4 }}>
              Fico de olho nos seus gastos, aviso quando algo foge do normal e respondo suas dúvidas sobre dinheiro.
            </T>
          </>
        )}
        <View style={styles.actions}>
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={top ? 'Conversar sobre isso' : 'Conversar com o Baiu'}
            hitSlop={8}
            style={styles.action}>
            <Icon name="chat" size={15} tint={color.lantern} />
            <T variant="calloutStrong" tone="lantern">
              {top ? 'Conversar sobre isso' : 'Conversar com o Baiu'}
            </T>
          </Pressable>
          {top ? (
            <Pressable
              onPress={() => onDismiss(alerts.map((a) => a.id))}
              accessibilityRole="button"
              accessibilityLabel="Dispensar"
              hitSlop={8}
              style={styles.action}>
              <T variant="callout" tone="ink3">
                Dispensar
              </T>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: gutter, marginTop: 18, alignItems: 'center' },
  tail: {
    width: 14,
    height: 14,
    marginBottom: -8,
    transform: [{ rotate: '45deg' }],
    backgroundColor: color.plate,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 182, 72, 0.35)',
    zIndex: 1,
  },
  bubble: {
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 182, 72, 0.35)',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
});
