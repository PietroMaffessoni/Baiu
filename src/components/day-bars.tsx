import { StyleSheet, View } from 'react-native';

import type { DayBar } from '@/lib/summary';
import { T } from '@/theme/text';
import { color } from '@/theme/tokens';

/**
 * O mês como textura: uma barra fina por dia, altura = gasto do dia.
 * Hoje acende em âmbar; um ponto jade marca os dias em que entrou dinheiro.
 */
export function DayBars({ bars, height = 56, labels = true }: { bars: DayBar[]; height?: number; labels?: boolean }) {
  const max = Math.max(1, ...bars.map((b) => b.spent));
  const total = bars.reduce((n, b) => n + b.spent, 0);
  return (
    <View accessible accessibilityLabel={`Gastos por dia nos últimos 30 dias. Total de ${Math.round(total)} reais.`}>
      <View style={[styles.row, { height }]}>
        {bars.map((b) => {
          const isToday = b.daysAgo === 0;
          const h = b.spent > 0 ? Math.max(3, Math.sqrt(b.spent / max) * height) : 1;
          return (
            <View key={b.daysAgo} style={styles.col}>
              <View
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor: isToday ? color.lantern : b.spent > 0 ? color.paper : color.lineStrong,
                    opacity: isToday ? 1 : b.spent > 0 ? 0.62 : 1,
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
          <View key={b.daysAgo} style={styles.col}>
            {b.earned ? <View style={styles.dot} /> : null}
          </View>
        ))}
      </View>
      {labels && (
        <View style={styles.labels}>
          <T variant="micro" tone="ink3">
            30 dias atrás
          </T>
          <T variant="micro" tone="ink3">
            hoje
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
