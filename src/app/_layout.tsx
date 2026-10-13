import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { StoreProvider, useStore } from '@/store/store';
import { color, font } from '@/theme/tokens';

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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [font.black]: require('../../assets/fonts/ZenMaruGothic-900Black.ttf'),
    [font.bold]: require('../../assets/fonts/ZenMaruGothic-700Bold.ttf'),
    [font.medium]: require('../../assets/fonts/ZenMaruGothic-500Medium.ttf'),
  });

  return (
    <StoreProvider>
      <Navigation fontsLoaded={fontsLoaded} />
    </StoreProvider>
  );
}

function Navigation({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { state, hydrated } = useStore();
  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.night } }}>
        <Stack.Protected guard={!state.onboarded}>
          <Stack.Screen name="boas-vindas" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={state.onboarded}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="conta/[id]" options={{ ...pushedHeader, title: '' }} />
          <Stack.Screen name="selos" options={{ ...pushedHeader, title: 'Selos' }} />
          <Stack.Screen name="ajustes" options={{ ...pushedHeader, title: 'Ajustes' }} />
          <Stack.Screen
            name="nova-conta"
            options={{ presentation: 'modal', contentStyle: { backgroundColor: color.night } }}
          />
          <Stack.Screen
            name="folego"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.94],
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              contentStyle: { backgroundColor: color.nightDeep },
            }}
          />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
