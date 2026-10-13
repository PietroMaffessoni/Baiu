import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { color } from '@/theme/tokens';

/** Barra de abas nativa: UITabBar no iPhone, barra de navegação Material no Android. */
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={color.nightDeep}
      tintColor={color.lantern}
      iconColor={{ default: color.ink3, selected: color.lantern }}
      labelStyle={{ default: { color: color.ink3 }, selected: { color: color.lantern } }}
      indicatorColor={color.plateHi}
      rippleColor={color.lanternWash}
      badgeBackgroundColor={color.vermilion}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="contas">
        <NativeTabs.Trigger.Label>Contas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'building.columns', selected: 'building.columns.fill' }}
          md="account_balance"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="extrato">
        <NativeTabs.Trigger.Label>Extrato</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }}
          md="receipt_long"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="investir">
        <NativeTabs.Trigger.Label>Investir</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="trending_up" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
