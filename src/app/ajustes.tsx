import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ListRow } from '@/components/form';
import { Plate, Rule } from '@/components/layout';
import { withoutCurtain } from '@/components/lock-gate';
import { Wordmark } from '@/components/wordmark';
import { accountsCsv, transactionsCsv } from '@/lib/csv';
import { authenticate, lockInfo, type LockInfo } from '@/lib/lock';
import { remindersAllowed } from '@/lib/reminders';
import { shareCsv } from '@/lib/share';
import { useAuth } from '@/store/auth';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

const today = () => new Date().toISOString().slice(0, 10);

export default function Ajustes() {
  const { state, dispatch, eraseAll } = useStore();
  const { profile, exitDemo } = useAuth();
  const insets = useSafeAreaInsets();
  const [lock, setLock] = useState<LockInfo | null>(null);
  const s = state.settings;

  useEffect(() => {
    lockInfo()
      .then(setLock)
      .catch(() => setLock({ available: false, method: 'Bloqueio' }));
  }, []);

  const toggleLock = async (on: boolean) => {
    if (on) {
      // confirma que a pessoa consegue desbloquear antes de ligar
      const ok = await withoutCurtain(() => authenticate('Ativar o bloqueio do Baiu'));
      if (!ok) return;
    }
    dispatch({ type: 'setSetting', key: 'lock', value: on });
  };

  const toggleReminders = async (on: boolean) => {
    if (on) {
      const ok = await withoutCurtain(() => remindersAllowed(true));
      if (!ok) {
        Alert.alert(
          'Notificações desligadas',
          'Para receber os lembretes, permita notificações do Baiu nos ajustes do aparelho.',
          [
            { text: 'Agora não', style: 'cancel' },
            { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    dispatch({ type: 'setSetting', key: 'reminders', value: on });
  };

  const exportTx = () =>
    shareCsv(`baiu-movimentos-${today()}.csv`, transactionsCsv(state)).catch((e) =>
      Alert.alert('Não deu para exportar', String(e?.message ?? e)),
    );
  const exportAccounts = () =>
    shareCsv(`baiu-contas-${today()}.csv`, accountsCsv(state)).catch((e) =>
      Alert.alert('Não deu para exportar', String(e?.message ?? e)),
    );

  const confirm = (title: string, message: string, action: string, run: () => void) => {
    if (Platform.OS === 'web') return run();
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: action, style: 'destructive', onPress: run },
    ]);
  };

  const eraseEverything = () =>
    confirm(
      'Apagar os dados deste aparelho?',
      'Contas, movimentos, vencimentos, investimentos e selos saem deste aparelho, junto com a chave de criptografia. Sua conta continua existindo. Isso não pode ser desfeito.',
      'Apagar',
      () => {
        eraseAll();
      },
    );

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8 }}>
      {state.demo && (
        <View style={styles.group}>
          <Plate style={{ padding: 16, gap: 12 }}>
            <T variant="callout" tone="ink2">
              Você está vendo dados de exemplo. Para usar o Baiu com o seu dinheiro, saia do exemplo e crie sua conta.
            </T>
            <Button
              label="Sair do modo exemplo"
              onPress={() => confirm('Sair do modo exemplo?', 'Os dados de exemplo serão descartados.', 'Sair', exitDemo)}
            />
          </Plate>
        </View>
      )}

      {profile ? (
        <Group title="Conta">
          <ListRow
            icon="lock"
            label={profile.fullName || 'Minha conta'}
            hint={profile.email}
            onPress={() => router.push('/minha-conta')}
            chevron
          />
        </Group>
      ) : null}

      <Group title="Privacidade e segurança">
        <ListRow
          icon={s.hideValues ? 'eyeOff' : 'eye'}
          label="Ocultar valores"
          hint="Esconde saldos e valores em todas as telas.">
          <Toggle
            value={s.hideValues}
            onChange={(v) => dispatch({ type: 'setSetting', key: 'hideValues', value: v })}
            label="Ocultar valores"
          />
        </ListRow>
        <Rule inset={33} />
        <ListRow
          icon="faceid"
          label={lock?.available ? `Bloquear com ${lock.method}` : 'Bloquear o app'}
          hint={lock?.available ? 'Pede ao abrir e ao voltar depois de 30 segundos.' : lock?.hint}>
          <Toggle value={s.lock} disabled={!lock?.available && !s.lock} onChange={toggleLock} label="Bloquear o app" />
        </ListRow>
      </Group>

      <Group title="Lembretes">
        <ListRow
          icon="bell"
          label="Avisar vencimentos"
          hint="Um dia antes e no dia, às 9h. Sem valores na notificação.">
          <Toggle value={s.reminders} onChange={toggleReminders} label="Avisar vencimentos" />
        </ListRow>
        <Rule inset={33} />
        <ListRow icon="calendar" label="Vencimentos" onPress={() => router.push('/vencimentos')} chevron />
      </Group>

      <Group title="Seus dados">
        <ListRow
          icon="share"
          label="Exportar movimentos"
          hint="Planilha CSV com todos os registros."
          onPress={exportTx}
          chevron
        />
        <Rule inset={33} />
        <ListRow
          icon="share"
          label="Exportar contas"
          hint="Planilha CSV com saldos atuais."
          onPress={exportAccounts}
          chevron
        />
        <Rule inset={33} />
        <ListRow
          icon="lock"
          label="Onde ficam"
          hint="Seus registros financeiros ficam só neste aparelho, criptografados. No servidor ficam apenas nome, e-mail e celular da conta."
        />
      </Group>

      <Group title="Baiu">
        <ListRow
          icon="sparkle"
          label="Personalizar o Baiu"
          hint="Cor e enfeites de datas comemorativas."
          onPress={() => router.push('/personalizar')}
          chevron
        />
        <Rule inset={33} />
        <ListRow icon="info" label="Como o fôlego funciona" onPress={() => router.push('/folego')} chevron />
        <Rule inset={33} />
        <ListRow icon="seal" label="Selos" onPress={() => router.push('/selos')} chevron />
      </Group>

      <Group title="Sobre">
        <ListRow icon="privacy" label="Política de privacidade" onPress={() => router.push('/privacidade')} chevron />
        <Rule inset={33} />
        <ListRow icon="doc" label="Termos de uso" onPress={() => router.push('/termos')} chevron />
        <Rule inset={33} />
        <ListRow
          icon="help"
          label="Ajuda e contato"
          onPress={() => Linking.openURL('https://github.com/PietroMaffessoni/Baiu/blob/main/docs/suporte.md')}
          chevron
        />
      </Group>

      <View style={styles.about}>
        <Wordmark width={88} tint={color.ink2} />
        <T variant="caption" tone="ink3" align="center" style={{ marginTop: 10 }}>
          Versão {version}
        </T>
      </View>

      {/* ação destrutiva sozinha, no fim */}
      {!state.demo ? (
        <View style={[styles.group, { marginTop: 56 }]}>
          <Button label="Apagar dados deste aparelho" kind="danger" icon="trash" onPress={eraseEverything} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: color.lantern, false: color.plateHi }}
      thumbColor={Platform.OS === 'android' ? color.paper : undefined}
      ios_backgroundColor={color.plateHi}
      accessibilityLabel={label}
    />
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <T variant="captionStrong" tone="ink3" style={styles.groupTitle}>
        {title}
      </T>
      <Plate style={{ paddingHorizontal: 14 }}>{children}</Plate>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  group: { marginTop: 24, paddingHorizontal: gutter },
  groupTitle: { marginBottom: 8, marginLeft: 4 },
  about: { alignItems: 'center', marginTop: 40 },
});
