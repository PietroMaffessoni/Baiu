import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';
import { Icon } from './icon';

type ScreenProps = ScrollViewProps & {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  /** Sem padding de topo (telas com fundo próprio). */
  bare?: boolean;
};

/** Tela de aba: título grande da marca, rolagem e respiro para a barra de abas. */
export function Screen({ title, subtitle, right, children, bare, contentContainerStyle, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        { paddingTop: bare ? 0 : insets.top + 12, paddingBottom: insets.bottom + 110 },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      {...rest}>
      {title ? (
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <T variant="title1" accessibilityRole="header">
              {title}
            </T>
            {subtitle ? (
              <T variant="callout" tone="ink2" style={{ marginTop: 2 }}>
                {subtitle}
              </T>
            ) : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Section({
  title,
  link,
  linkLabel = 'Ver tudo',
  children,
  style,
}: {
  title: string;
  link?: Href;
  linkLabel?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <T variant="title2" accessibilityRole="header">
          {title}
        </T>
        {link ? (
          <Link href={link} asChild>
            <Pressable hitSlop={10} style={styles.link} accessibilityRole="link">
              <T variant="calloutStrong" tone="lantern">
                {linkLabel}
              </T>
              <Icon name="chevron" size={13} tint={color.lantern} weight="semibold" />
            </Pressable>
          </Link>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Placa: superfície elevada por tom, separada por fio, nunca por sombra. */
export function Plate({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.plate, style]}>{children}</View>;
}

export function Rule({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.rule, { marginLeft: inset }]} />;
}

export function DemoNote() {
  return (
    <View style={styles.demo}>
      <View style={styles.demoDot} />
      <T variant="micro" tone="ink3">
        Dados de demonstração, salvos só neste aparelho
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: gutter,
    marginBottom: 20,
    gap: 12,
  },
  section: { marginTop: 36, paddingHorizontal: gutter },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  plate: {
    backgroundColor: color.plate,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.line },
  demo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40 },
  demoDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: color.ink3 },
});
