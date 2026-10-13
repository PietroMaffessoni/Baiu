import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sealsFor } from '@/lib/seals';
import { Seal } from '@/components/seal';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

export default function Selos() {
  const { state } = useStore();
  const folego = useFolego();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const seals = useMemo(() => sealsFor(state, folego), [state, folego]);
  const earned = seals.filter((s) => s.earned).length;

  const cols = 3;
  const cell = Math.floor((width - gutter * 2) / cols);
  const size = Math.min(96, cell - 18);

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8 }}>
      <View style={styles.pad}>
        <T variant="title1">
          {earned} de {seals.length}
        </T>
        <T variant="callout" tone="ink2" style={{ marginTop: 4, maxWidth: 340 }}>
          Cada hábito que cuida do seu dinheiro vira um carimbo. Os que faltam mostram o caminho.
        </T>
      </View>
      <View style={[styles.grid, styles.pad]}>
        {seals.map((s, i) => (
          <View key={s.id} style={[styles.cell, { width: cell }]}>
            <Seal lines={s.lines} date={s.date} earned={s.earned} size={size} seed={i + 1} />
            <T variant="captionStrong" align="center" tone={s.earned ? 'paper' : 'ink2'} style={{ marginTop: 10 }}>
              {s.title}
            </T>
            <T variant="micro" tone="ink3" align="center" style={{ marginTop: 2 }}>
              {s.how}
            </T>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 24, rowGap: 26 },
  cell: { alignItems: 'center', paddingHorizontal: 6 },
});
