import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Plate, Rule } from '@/components/layout';
import { Wordmark } from '@/components/wordmark';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

export default function Ajustes() {
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();

  const reset = () => {
    const go = () => dispatch({ type: 'reset' });
    if (Platform.OS === 'web') return go();
    Alert.alert('Restaurar dados de exemplo?', 'As contas que você adicionou serão apagadas deste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8 }}>
      <Group title="Privacidade">
        <Row
          icon={state.hideValues ? 'eyeOff' : 'eye'}
          label="Ocultar valores"
          hint="Esconde saldos e valores em todas as telas.">
          <Switch
            value={state.hideValues}
            onValueChange={() => dispatch({ type: 'toggleHide' })}
            trackColor={{ true: color.lantern, false: color.plateHi }}
            thumbColor={Platform.OS === 'android' ? color.paper : undefined}
            ios_backgroundColor={color.plateHi}
            accessibilityLabel="Ocultar valores"
          />
        </Row>
      </Group>

      <Group title="Baiu">
        <Row icon="info" label="Como o fôlego funciona" onPress={() => router.push('/folego')} chevron />
        <Rule inset={46} />
        <Row icon="seal" label="Selos" onPress={() => router.push('/selos')} chevron />
      </Group>

      <Group title="Demonstração">
        <Row icon="repeat" label="Restaurar dados de exemplo" onPress={reset} />
        <Rule inset={46} />
        <Row icon="bolt" label="Ver as boas-vindas de novo" onPress={() => dispatch({ type: 'replayWelcome' })} />
      </Group>

      <View style={styles.about}>
        <Wordmark width={88} tint={color.ink2} />
        <T variant="caption" tone="ink3" align="center" style={{ marginTop: 10 }}>
          Versão 0.1, prévia visual.{'\n'}Tudo fica salvo só neste aparelho.
        </T>
      </View>
    </ScrollView>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <T variant="captionStrong" tone="ink3" style={styles.groupTitle}>
        {title}
      </T>
      <Plate style={{ paddingHorizontal: 14 }}>{children}</Plate>
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  chevron,
  children,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress?: () => void;
  chevron?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <View style={styles.row}>
      <Icon name={icon} size={19} tint={color.ink2} />
      <View style={{ flex: 1 }}>
        <T variant="body">{label}</T>
        {hint ? (
          <T variant="caption" tone="ink3">
            {hint}
          </T>
        ) : null}
      </View>
      {children}
      {chevron ? <Icon name="chevron" size={13} tint={color.ink3} weight="semibold" /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }} accessibilityRole="button">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  group: { marginTop: 24, paddingHorizontal: gutter },
  groupTitle: { marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 10 },
  about: { alignItems: 'center', marginTop: 48 },
});
