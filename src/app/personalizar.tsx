import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { useBaiuLook } from '@/components/baiu/use-look';
import { Icon } from '@/components/icon';
import { tick } from '@/components/keypad';
import { Plate, Rule } from '@/components/layout';
import { MESES } from '@/lib/dates';
import { COLORS, paletteFor, SEASONS, upcomingSeasons, type Season } from '@/lib/look';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

function range(start: Date, end: Date) {
  const m1 = MESES[start.getMonth()];
  const m2 = MESES[end.getMonth()];
  if (start.getTime() === end.getTime()) return `${start.getDate()} de ${m1}`;
  if (m1 === m2) return `${start.getDate()} a ${end.getDate()} de ${m1}`;
  return `${start.getDate()} de ${m1} a ${end.getDate()} de ${m2}`;
}

/** Cor do Baiu e enfeites das datas. Um extra simples: dois toques e pronto. */
export default function Personalizar() {
  const { state, dispatch } = useStore();
  const folego = useFolego();
  const look = useBaiuLook();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [preview, setPreview] = useState<Season | null>(null);

  const chosen = state.baiu.color;
  const shown = preview ?? look.season;
  const upcoming = upcomingSeasons();
  const today = look.season ? SEASONS.find((s) => s.id === look.season) : null;
  const previewing = preview ? SEASONS.find((s) => s.id === preview) : null;
  const fishW = Math.min(230, Math.round(width * 0.58));

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8 }}>
      <View style={styles.stage}>
        <Baiu score={folego.score} width={fishW} interactive season={shown} />
        <View style={styles.caption} accessibilityLiveRegion="polite">
          {previewing ? (
            <>
              <T variant="callout" tone="ink2" align="center">
                Prévia: {previewing.name}
              </T>
              <Pressable onPress={() => setPreview(null)} hitSlop={8} accessibilityRole="button">
                <T variant="calloutStrong" tone="lantern">
                  Voltar ao normal
                </T>
              </Pressable>
            </>
          ) : today ? (
            <T variant="callout" tone="ink2" align="center">
              Hoje o Baiu está enfeitado para {today.para}.
            </T>
          ) : (
            <T variant="callout" tone="ink3" align="center">
              Segure o Baiu para ele estufar.
            </T>
          )}
        </View>
      </View>

      <View style={styles.group}>
        <T variant="captionStrong" tone="ink3" style={styles.groupTitle}>
          Cor
        </T>
        <Plate style={styles.swatches}>
          {COLORS.map((c) => {
            const on = c.id === chosen;
            const pal = paletteFor(c.id, 'cheio');
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  tick();
                  dispatch({ type: 'setBaiu', patch: { color: c.id } });
                }}
                style={styles.swatch}
                accessibilityRole="radio"
                aria-checked={on}
                accessibilityLabel={c.name}>
                <View style={[styles.dot, { backgroundColor: c.base, borderColor: on ? color.paper : pal.rim }]}>
                  <View style={[styles.dotBelly, { backgroundColor: pal.belly }]} />
                  {on ? <Icon name="check" size={16} tint={color.night} weight="semibold" /> : null}
                </View>
                <T variant="micro" tone={on ? 'paper' : 'ink3'} align="center">
                  {c.name}
                </T>
              </Pressable>
            );
          })}
        </Plate>
      </View>

      <View style={styles.group}>
        <T variant="captionStrong" tone="ink3" style={styles.groupTitle}>
          Datas comemorativas
        </T>
        <Plate style={{ paddingHorizontal: 14 }}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <T variant="body">Enfeitar nas datas</T>
              <T variant="caption" tone="ink3">
                O Baiu se veste sozinho no Natal, na Páscoa, no Halloween e em outras datas.
              </T>
            </View>
            <Switch
              value={state.baiu.seasonal}
              onValueChange={(v) => dispatch({ type: 'setBaiu', patch: { seasonal: v } })}
              trackColor={{ true: color.lantern, false: color.plateHi }}
              thumbColor={Platform.OS === 'android' ? color.paper : undefined}
              ios_backgroundColor={color.plateHi}
              accessibilityLabel="Enfeitar nas datas"
            />
          </View>
          {upcoming.map((r) => {
            const s = SEASONS.find((x) => x.id === r.id)!;
            const active = preview === r.id;
            return (
              <View key={`${r.id}-${r.start.getFullYear()}`}>
                <Rule />
                <Pressable
                  onPress={() => {
                    tick();
                    setPreview(active ? null : r.id);
                  }}
                  style={styles.seasonRow}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name}, ${range(r.start, r.end)}. ${active ? 'Tirar a prévia' : 'Ver a prévia'}`}>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">{s.name}</T>
                    <T variant="caption" tone="ink3">
                      {range(r.start, r.end)} · {s.look}
                    </T>
                  </View>
                  <T variant="calloutStrong" tone={active ? 'paper' : 'lantern'}>
                    {active ? 'Vendo' : 'Ver'}
                  </T>
                </Pressable>
              </View>
            );
          })}
        </Plate>
        <T variant="caption" tone="ink3" style={{ marginTop: 10, marginHorizontal: 4 }}>
          A cor e os enfeites são só visuais. O humor e o tamanho do Baiu continuam mostrando o seu fôlego.
        </T>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  stage: { alignItems: 'center', paddingTop: 8 },
  caption: { minHeight: 48, alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: gutter },
  group: { marginTop: 24, paddingHorizontal: gutter },
  groupTitle: { marginBottom: 8, marginLeft: 4 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 14, paddingHorizontal: 6, rowGap: 14 },
  swatch: { width: '25%', alignItems: 'center', gap: 6, minHeight: 72 },
  dot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dotBelly: { position: 'absolute', bottom: -12, width: 40, height: 26, borderRadius: 20, opacity: 0.9 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  seasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
});
