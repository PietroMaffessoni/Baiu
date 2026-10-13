import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { Button } from '@/components/button';
import { LockGate } from '@/components/lock-gate';
import { useReminderRouting } from '@/lib/reminders';
import { StoreProvider, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, font, gutter } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 350 });

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: color.lantern,
    background: color.night,
    card: color.night,
    text: color.paper,
    border: color.line,
    notification: color.vermilion,
  },
};

const pushedHeader = {
  headerShown: true,
  headerStyle: { backgroundColor: color.night },
  headerTintColor: color.lantern,
  headerTitleStyle: { fontFamily: font.bold, color: color.paper, fontSize: 17 },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
};

const modal = { presentation: 'modal' as const, contentStyle: { backgroundColor: color.night } };

const sheet = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.94],
  sheetGrabberVisible: true,
  sheetCornerRadius: 28,
  contentStyle: { backgroundColor: color.nightDeep },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [font.black]: require('../../assets/fonts/ZenMaruGothic-900Black.ttf'),
    [font.bold]: require('../../assets/fonts/ZenMaruGothic-700Bold.ttf'),
  });

  return (
    <StoreProvider>
      <Navigation fontsLoaded={fontsLoaded} />
    </StoreProvider>
  );
}

function Navigation({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { state, hydrated, unreadable } = useStore();
  const ready = fontsLoaded && hydrated;
  useReminderRouting(ready && state.onboarded);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      {unreadable ? (
        <Unreadable />
      ) : (
        <LockGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.night } }}>
            <Stack.Protected guard={!state.onboarded}>
              <Stack.Screen name="boas-vindas" options={{ animation: 'fade' }} />
            </Stack.Protected>
            <Stack.Protected guard={state.onboarded}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="conta/[id]" options={{ ...pushedHeader, title: '' }} />
              <Stack.Screen name="vencimentos" options={{ ...pushedHeader, title: 'Vencimentos' }} />
              <Stack.Screen name="selos" options={{ ...pushedHeader, title: 'Selos' }} />
              <Stack.Screen name="ajustes" options={{ ...pushedHeader, title: 'Ajustes' }} />
              <Stack.Screen name="privacidade" options={{ ...pushedHeader, title: 'Privacidade' }} />
              <Stack.Screen name="termos" options={{ ...pushedHeader, title: 'Termos de uso' }} />
              <Stack.Screen name="nova-conta" options={modal} />
              <Stack.Screen name="conta-editar" options={modal} />
              <Stack.Screen name="movimento/novo" options={modal} />
              <Stack.Screen name="vencimento/novo" options={modal} />
              <Stack.Screen name="investimento/novo" options={modal} />
              <Stack.Screen name="investimento/operacao" options={modal} />
              <Stack.Screen name="movimento/[id]" options={sheet} />
              <Stack.Screen name="vencimento/[id]" options={sheet} />
              <Stack.Screen name="investimento/[id]" options={sheet} />
              <Stack.Screen name="folego" options={sheet} />
            </Stack.Protected>
          </Stack>
        </LockGate>
      )}
    </ThemeProvider>
  );
}

/** Os dados existem, mas a chave do aparelho não abre mais (por exemplo, backup restaurado em outro aparelho). */
function Unreadable() {
  const { eraseAll } = useStore();
  const insets = useSafeAreaInsets();
  const confirm = () =>
    Alert.alert('Começar de novo?', 'Os dados guardados neste aparelho serão apagados. Isso não pode ser desfeito.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar e começar', style: 'destructive', onPress: () => eraseAll() },
    ]);
  return (
    <View style={[styles.unreadable, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
      <View style={{ alignItems: 'center' }}>
        <Baiu score={5} width={140} still />
        <T variant="title2" align="center" style={{ marginTop: 18 }} accessibilityRole="header">
          Não deu para abrir seus dados
        </T>
        <T variant="callout" tone="ink2" align="center" style={{ marginTop: 8, maxWidth: 320 }}>
          Seus dados ficam cifrados com uma chave presa a este aparelho. Ela não está disponível, o que acontece ao
          restaurar um backup em outro celular. Sem a chave, ninguém consegue ler esses dados, nem o Baiu.
        </T>
      </View>
      <Button label="Apagar e começar de novo" kind="danger" onPress={confirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  unreadable: { flex: 1, backgroundColor: color.night, paddingHorizontal: gutter, justifyContent: 'space-between' },
});
