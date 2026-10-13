import { StyleSheet, View } from 'react-native';

import type { DayBar } from '@/lib/summary';
import { T } from '@/theme/text';
import { color } from '@/theme/tokens';

/**
 * O período como textura: uma barra fina por dia, altura = gasto do dia.
 * Hoje acende em âmbar; um ponto jade marca os dias em que entrou dinheiro.
 */
export function DayBars({
  bars,
  height = 56,
  labels = ['30 dias atrás', 'hoje'],
}: {
  bars: DayBar[];
  height?: number;
  labels?: [string, string] | null;
}) {
  const max = Math.max(1, ...bars.map((b) => b.spent));
  const total = bars.reduce((n, b) => n + b.spent, 0);
  return (
    <View accessible accessibilityLabel={`Gastos por dia no período. Total de ${Math.round(total)} reais.`}>
      <View style={[styles.row, { height }]}>
        {bars.map((b) => {
          const h = b.spent > 0 ? Math.max(3, Math.sqrt(b.spent / max) * height) : 1;
          return (
            <View key={b.key} style={styles.col}>
              <View
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor: b.isToday ? color.lantern : b.spent > 0 ? color.paper : color.lineStrong,
                    opacity: b.isToday ? 1 : b.spent > 0 ? 0.62 : 1,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.base} />
      <View style={styles.dots}>
        {bars.map((b) => (
          <View key={b.key} style={styles.col}>
            {b.earned ? <View style={styles.dot} /> : null}
          </View>
        ))}
      </View>
      {labels && (
        <View style={styles.labels}>
          <T variant="micro" tone="ink3">
            {labels[0]}
          </T>
          <T variant="micro" tone="ink3">
            {labels[1]}
          </T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  col: { flex: 1, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 6, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  base: { height: StyleSheet.hairlineWidth, backgroundColor: color.lineStrong, marginTop: 1 },
  dots: { flexDirection: 'row', gap: 3, height: 9, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.jade },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
});
