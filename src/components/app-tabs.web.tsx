import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import type { Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { T } from '@/theme/text';
import { color } from '@/theme/tokens';
import { Icon, type IconName } from './icon';

/** Na web (só para visualização), uma barra simples no mesmo vocabulário. */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={styles.bar}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton icon="home">Início</TabButton>
        </TabTrigger>
        <TabTrigger name="contas" href="/contas" asChild>
          <TabButton icon="bank">Contas</TabButton>
        </TabTrigger>
        <TabTrigger name="extrato" href="/extrato" asChild>
          <TabButton icon="calendar">Extrato</TabButton>
        </TabTrigger>
        <TabTrigger name="investir" href="/investir" asChild>
          <TabButton icon="growth">Investir</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

// O expo-router ainda tipa o ref do gatilho com o tipo antigo de View; aqui ele chega como a view nativa.
type TabButtonProps = Omit<TabTriggerSlotProps, 'ref'> & { ref?: Ref<ViewInstance>; icon: IconName };

function TabButton({ children, isFocused, icon, ...props }: TabButtonProps) {
  const tint = isFocused ? color.lantern : color.ink3;
  return (
    <Pressable {...props} style={styles.btn}>
      <View style={[styles.pill, isFocused && { backgroundColor: color.plateHi }]}>
        <Icon name={icon} size={22} tint={tint} />
      </View>
      <T variant="micro" style={{ color: tint }}>
        {children}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: color.nightDeep,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
    paddingTop: 8,
    paddingBottom: 14,
  },
  btn: { flex: 1, alignItems: 'center', gap: 3 },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
