import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { Icon } from '@/components/icon';
import { Plate, Rule } from '@/components/layout';
import { Mark, type MarkState } from '@/components/mark';
import { MOODS } from '@/lib/folego';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, font, gutter } from '@/theme/tokens';

export default function FolegoSheet() {
  const folego = useFolego();
  const { state } = useStore();
  const insets = useSafeAreaInsets();

  const markFor = (points: number): { s: MarkState; f?: number } =>
    points >= 24.5 ? { s: 'cheia' } : points <= 0.5 ? { s: 'vazia' } : { s: 'parcial', f: points / 25 };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: 28, paddingBottom: insets.bottom + 40 }}>
      <View style={styles.top}>
        <Baiu score={folego.score} width={132} halo />
        <View style={{ flex: 1 }}>
          <T variant="caption" tone="ink2">
            Fôlego
          </T>
          <View style={styles.scoreRow}>
            <Text allowFontScaling={false} style={styles.score}>
              {folego.score}
            </Text>
            <T variant="callout" tone="ink3">
              de 100
            </T>
          </View>
          <T variant="title3">{folego.mood.line}</T>
        </View>
      </View>

      {/* escala: os quatro estados do Baiu */}
      <View style={styles.pad}>
        <View style={styles.scale}>
          {MOODS.map((m, i) => {
            const end = MOODS[i + 1]?.from ?? 100;
            const fill = Math.min(1, Math.max(0, (folego.score - m.from) / (end - m.from)));
            const active = folego.mood.mood === m.mood;
            return (
              <View key={m.mood} style={{ flex: 1 }}>
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${fill * 100}%` }]} />
                </View>
                <View style={styles.stateCell}>
                  <Baiu score={m.from + 12} mood={m.mood} width={46} still halo={false} />
                  <T variant="micro" tone={active ? 'lantern' : 'ink3'} align="center">
                    {m.label}
                  </T>
                  <T variant="micro" tone="ink3" align="center" tabular>
                    {m.from}
                  </T>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.pad}>
        <T variant="title2" style={{ marginTop: 30, marginBottom: 6 }} accessibilityRole="header">
          Quatro pilares, 25 pontos cada
        </T>
        <T variant="callout" tone="ink2" style={{ marginBottom: 14 }}>
          O tamanho e a luz do Baiu leem só este número. Nada aqui é sorte: cada pilar tem uma regra.
        </T>
        <Plate style={{ paddingHorizontal: 14 }}>
          {folego.pillars.map((p, i) => {
            const m = markFor(p.points);
            return (
              <View key={p.key}>
                {i > 0 && <Rule inset={36} />}
                <View style={styles.pillar}>
                  <Mark state={m.s} fill={m.f} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="bodyStrong">{p.title}</T>
                    <T variant="callout" tone="ink2">
                      {p.detail}
                    </T>
                    <T variant="caption" tone="ink3">
                      {p.rule}
                    </T>
                  </View>
                  <T variant="calloutStrong" tabular tone={m.s === 'cheia' ? 'lantern' : 'paper'}>
                    {Math.round(p.points)}
                    <T variant="caption" tone="ink3">
                      /25
                    </T>
                  </T>
                </View>
              </View>
            );
          })}
        </Plate>

        <View style={styles.habit}>
          <View style={styles.habitGlyph}>
            <Icon name="bolt" size={16} tint={color.night} weight="semibold" />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="captionStrong" tone="lantern">
              Próximo passo
            </T>
            <T variant="callout">
              {state.settings.hideValues ? folego.habit.text.replace(/R\$\s?[\d.,]+/g, 'um valor') : folego.habit.text}
            </T>
          </View>
        </View>

        <T variant="caption" tone="ink3" style={{ marginTop: 18 }}>
          O fôlego é recalculado sempre que algo muda e usa os últimos 30 dias de movimentos. As sugestões são
          educativas e gerais: não são recomendação de investimento nem consultoria financeira.
        </T>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.nightDeep },
  pad: { paddingHorizontal: gutter },
  top: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: gutter, marginBottom: 22 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  score: { fontFamily: font.black, fontSize: 64, lineHeight: 76, color: color.paper, letterSpacing: -1.5 },
  scale: { flexDirection: 'row', gap: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: color.plateHi, overflow: 'hidden' },
  trackFill: { height: 6, backgroundColor: color.lantern },
  stateCell: { alignItems: 'center', marginTop: 10, gap: 2 },
  pillar: { flexDirection: 'row', gap: 14, paddingVertical: 14, alignItems: 'flex-start' },
  habit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  habitGlyph: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: color.lantern,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
