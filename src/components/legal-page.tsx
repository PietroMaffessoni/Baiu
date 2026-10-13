import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import legal from '@/content/legal.json';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

type Doc = (typeof legal)['privacy'];

export function LegalPage({ doc }: { doc: Doc }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8, paddingHorizontal: gutter }}>
      <T variant="title1" accessibilityRole="header">
        {doc.title}
      </T>
      <T variant="caption" tone="ink3" style={{ marginTop: 4 }}>
        Atualizada em {legal.updated}
      </T>
      <T variant="body" tone="ink2" style={{ marginTop: 16 }}>
        {doc.intro}
      </T>
      {doc.sections.map((s) => (
        <View key={s.heading} style={{ marginTop: 26 }}>
          <T variant="title3" accessibilityRole="header">
            {s.heading}
          </T>
          {s.body.map((p, i) => (
            <T key={i} variant="body" tone="ink2" style={{ marginTop: 8 }}>
              {p}
            </T>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
});
