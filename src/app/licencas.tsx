import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Plate, Rule } from '@/components/layout';
import licencas from '@/content/licencas.json';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

type Item = { name: string; version?: string; license: string; text: string };

/** Fonte e bibliotecas de código aberto que vão dentro do app, com o texto de cada licença. */
export default function Licencas() {
  const insets = useSafeAreaInsets();
  const items: Item[] = [...licencas.fonts, ...licencas.packages];
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8, paddingHorizontal: gutter }}>
      <T variant="title1" accessibilityRole="header">
        Licenças de código aberto
      </T>
      <T variant="body" tone="ink2" style={{ marginTop: 12 }}>
        O Baiu usa a fonte e as bibliotecas abaixo, de código aberto. Toque em cada uma para ler a licença e os
        direitos autorais de quem a criou.
      </T>
      <Plate style={{ marginTop: 20, paddingHorizontal: 14 }}>
        {items.map((it, i) => (
          <View key={it.name}>
            {i > 0 ? <Rule /> : null}
            <Entry item={it} />
          </View>
        ))}
      </Plate>
    </ScrollView>
  );
}

function Entry({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${item.name}, licença ${item.license}`}>
        <View style={{ flex: 1 }}>
          <T variant="calloutStrong">{item.name}</T>
          <T variant="caption" tone="ink2">
            {item.version ? `${item.version} · ` : ''}
            {item.license}
          </T>
        </View>
        <Icon name={open ? 'up' : 'down'} size={16} tint={color.ink2} />
      </Pressable>
      {open ? (
        <T variant="caption" tone="ink2" style={styles.text} selectable>
          {item.text}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  text: { paddingBottom: 14 },
});
