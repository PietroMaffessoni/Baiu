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
import { useAssistantUpkeep } from '@/lib/assistant/use-assistant';
import { useBankUpkeep } from '@/lib/bank/use-bank';
import { useReminderRouting } from '@/lib/reminders';
import { useSubscriptionUpkeep } from '@/lib/subscription/use-subscription';
import { AuthProvider, useAuth } from '@/store/auth';
import { StoreProvider, useStore, type Owner } from '@/store/store';
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
    <AuthProvider>
      <Owned fontsLoaded={fontsLoaded} />
    </AuthProvider>
  );
}

/** Cada conta (ou o modo exemplo) tem o próprio estado; trocar de dono recomeça do zero. */
function Owned({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { status, profile, demo, recovering } = useAuth();
  const owner: Owner = status === 'signedIn' && profile && !recovering ? profile.id : demo ? 'demo' : null;
  return (
    <StoreProvider key={owner ?? 'ninguem'} owner={owner}>
      <Navigation fontsLoaded={fontsLoaded} authReady={status !== 'loading'} />
    </StoreProvider>
  );
}

function Navigation({ fontsLoaded, authReady }: { fontsLoaded: boolean; authReady: boolean }) {
  const { owner, hydrated, unreadable, state } = useStore();
  const inApp = owner !== null;
  const signedIn = inApp && owner !== 'demo';
  // sem assinatura ativa, só a tela de assinar, a conta e os textos legais ficam abertos
  const sub = useSubscriptionUpkeep(signedIn ? owner : null, state.settings.trialReminder);
  const locked = signedIn && sub.locked;
  const ready = fontsLoaded && authReady && hydrated && sub.ready;
  useReminderRouting(ready && signedIn);
  useAssistantUpkeep(ready && signedIn && !unreadable && !locked);
  useBankUpkeep(ready && signedIn && !unreadable && !locked);

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
            <Stack.Protected guard={!inApp}>
              <Stack.Screen name="boas-vindas" options={{ animation: 'fade' }} />
              <Stack.Screen name="cadastro" />
              <Stack.Screen name="entrar" />
              <Stack.Screen name="verificar-email" />
              <Stack.Screen name="recuperar-senha" />
            </Stack.Protected>
            <Stack.Protected guard={inApp && !locked}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="conta/[id]" options={{ ...pushedHeader, title: '' }} />
              <Stack.Screen name="vencimentos" options={{ ...pushedHeader, title: 'Vencimentos' }} />
              <Stack.Screen name="selos" options={{ ...pushedHeader, title: 'Selos' }} />
              <Stack.Screen name="ajustes" options={{ ...pushedHeader, title: 'Ajustes' }} />
              <Stack.Screen name="personalizar" options={{ ...pushedHeader, title: 'Personalizar o Baiu' }} />
              <Stack.Screen name="baiu" />
              <Stack.Screen name="assistente-dados" options={sheet} />
              <Stack.Screen name="conectar" options={modal} />
              <Stack.Screen name="bancos" options={{ ...pushedHeader, title: 'Bancos conectados' }} />
              <Stack.Screen name="autorizacao/[id]" options={{ ...pushedHeader, title: 'Autorização' }} />
              <Stack.Screen name="revisar" options={{ ...pushedHeader, title: 'Confira' }} />
              <Stack.Screen name="open-finance" options={{ animation: 'none' }} />
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
            <Stack.Protected guard={signedIn}>
              {/* primeira da lista: é para onde vai quem está sem assinatura */}
              <Stack.Screen name="assinatura" options={{ ...pushedHeader, title: 'Assinatura' }} />
              <Stack.Screen name="minha-conta" options={{ ...pushedHeader, title: 'Minha conta' }} />
            </Stack.Protected>
            {/* abertas para todos: o cadastro tem links para elas */}
            <Stack.Screen name="privacidade" options={{ ...pushedHeader, title: 'Privacidade' }} />
            <Stack.Screen name="termos" options={{ ...pushedHeader, title: 'Termos de uso' }} />
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
        <Baiu score={5} width={164} still />
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
