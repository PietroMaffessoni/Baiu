import { StyleSheet, Text, View } from 'react-native';

import { bankById } from '@/data/banks';
import { font } from '@/theme/tokens';

/** Monograma da instituição. Iniciais e uma cor próxima, nunca a marca do banco. */
export function BankMark({ bankId, size = 40 }: { bankId: string; size?: number }) {
  const bank = bankById(bankId);
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: bank.bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text
        allowFontScaling={false}
        style={{ fontFamily: font.black, color: bank.fg, fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {bank.mono}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
});
