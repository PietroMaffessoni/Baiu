import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, FormError, FormNote, PasswordChecklist, PasswordField } from '@/components/auth-form';
import { Button } from '@/components/button';
import { ListRow } from '@/components/form';
import { Plate, Rule } from '@/components/layout';
import { AuthFailure, authMessage } from '@/lib/auth';
import { BankFailure, bankBackend } from '@/lib/bank/client';
import { checkName, checkPassword, checkPhone, formatName, formatPhone, passwordProblem } from '@/lib/auth/validation';
import { useAuth } from '@/store/auth';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

const SUPPORT = 'suporte.baiu@gmail.com';

/** Antes de excluir a conta, encerra as conexões com bancos no provedor (LGPD: nada fica para trás). */
async function disconnectBanks() {
  if (!bankBackend.available) return;
  try {
    await bankBackend.unlinkAll();
  } catch (e) {
    // sem a função de bancos no servidor, não há conexão para encerrar
    if (e instanceof BankFailure && e.code === 'not_configured') return;
    throw new AuthFailure(
      'network',
      'Não deu para desconectar seus bancos antes de excluir a conta. Confira a internet e tente de novo.',
    );
  }
}

export default function MinhaConta() {
  const { profile, updateProfile, changePassword, deleteAccount, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  if (!profile) return <View style={styles.screen} />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8 }}>
        <ProfileForm
          fullName={profile.fullName}
          phone={profile.phone}
          email={profile.email}
          onSave={updateProfile}
        />
        <PasswordForm email={profile.email} name={profile.fullName} onSave={changePassword} />

        <Group title="Seus dados e a LGPD">
          <View style={{ paddingVertical: 14, gap: 8 }}>
            <T variant="callout" tone="ink2">
              No servidor do Baiu ficam só o nome, o e-mail, o celular e o registro de quando você aceitou os termos.
              Contas, movimentos e investimentos ficam apenas neste aparelho, criptografados.
            </T>
            <T variant="callout" tone="ink2">
              Você pode corrigir seus dados aqui, exportar seus registros em Ajustes e excluir a conta abaixo. Para
              qualquer outro pedido, escreva para {SUPPORT}.
            </T>
          </View>
          <Rule />
          <ListRow icon="privacy" label="Política de privacidade" onPress={() => router.push('/privacidade')} chevron />
          <Rule inset={33} />
          <ListRow icon="help" label="Falar com o suporte" onPress={() => Linking.openURL(`mailto:${SUPPORT}`)} chevron />
        </Group>

        <View style={[styles.group, { marginTop: 32 }]}>
          <Button
            label="Sair da conta"
            kind="secondary"
            onPress={() =>
              confirm('Sair da conta?', 'Seus registros continuam guardados neste aparelho para quando você voltar.', 'Sair', () =>
                signOut(),
              )
            }
          />
        </View>

        <DeleteAccount onDelete={(password) => deleteAccount(password, disconnectBanks)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function confirm(title: string, message: string, action: string, run: () => void, destructive = false) {
  if (Platform.OS === 'web') return run();
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: action, style: destructive ? 'destructive' : 'default', onPress: run },
  ]);
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

function ProfileForm({
  fullName,
  phone,
  email,
  onSave,
}: {
  fullName: string;
  phone: string;
  email: string;
  onSave: (p: { fullName: string; phone: string }) => Promise<void>;
}) {
  const [name, setName] = useState(fullName);
  const [tel, setTel] = useState(formatPhone(phone));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const nameC = checkName(name);
  const telC = checkPhone(tel);
  const changed = (nameC.ok ? nameC.name : name) !== fullName || (telC.ok ? telC.e164 : tel) !== phone;

  const save = async () => {
    setError(null);
    setSaved(false);
    if (!nameC.ok || !telC.ok) return;
    setLoading(true);
    try {
      await onSave({ fullName: nameC.name, phone: telC.e164 });
      setSaved(true);
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.group}>
      <T variant="captionStrong" tone="ink3" style={styles.groupTitle}>
        Seus dados
      </T>
      <Field
        label="Nome completo"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setSaved(false);
        }}
        onBlur={() => setName(formatName(name))}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={80}
        error={!nameC.ok ? nameC.error : null}
      />
      <Field
        label="Celular com DDD"
        value={tel}
        onChangeText={(t) => {
          setTel(formatPhone(t));
          setSaved(false);
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={16}
        error={!telC.ok ? telC.error : null}
      />
      <Field
        label="E-mail"
        value={email}
        editable={false}
        style={{ color: color.ink2 }}
        hint={`Para trocar o e-mail da conta, escreva para ${SUPPORT}.`}
      />
      <FormError message={error} />
      {saved ? <FormNote tone="jade">Dados atualizados.</FormNote> : null}
      <Button label="Salvar dados" onPress={save} loading={loading} disabled={!changed || !nameC.ok || !telC.ok} />
    </View>
  );
}

function PasswordForm({
  email,
  name,
  onSave,
}: {
  email: string;
  name: string;
  onSave: (current: string, next: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const personal = { email, name };
  const nextC = checkPassword(next, personal);

  const save = async () => {
    setError(null);
    if (!current) return setError('Digite sua senha atual.');
    if (!nextC.ok) return setError(nextC.error);
    if (current === next) return setError('A nova senha precisa ser diferente da atual.');
    setLoading(true);
    try {
      await onSave(current, next);
      setDone(true);
      setOpen(false);
      setCurrent('');
      setNext('');
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.group, { marginTop: 28 }]}>
      <T variant="captionStrong" tone="ink3" style={styles.groupTitle}>
        Senha
      </T>
      {done && !open ? <FormNote tone="jade">Senha trocada.</FormNote> : null}
      {!open ? (
        <Button
          label="Trocar senha"
          kind="secondary"
          icon="lock"
          onPress={() => {
            setOpen(true);
            setDone(false);
          }}
        />
      ) : (
        <>
          <PasswordField label="Senha atual" value={current} onChangeText={setCurrent} placeholder="Sua senha de agora" />
          <PasswordField isNew label="Senha nova" value={next} onChangeText={setNext} placeholder="Crie uma senha forte" />
          <PasswordChecklist
            password={next}
            personal={personal}
            problem={next.length >= 8 ? passwordProblem(next, personal) : null}
          />
          <FormError message={error} />
          <Button label="Salvar senha nova" onPress={save} loading={loading} />
          <View style={{ marginTop: 8 }}>
            <Button
              label="Cancelar"
              kind="quiet"
              onPress={() => {
                setOpen(false);
                setError(null);
                setCurrent('');
                setNext('');
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}

function DeleteAccount({ onDelete }: { onDelete: (password: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    if (!password) return setError('Digite sua senha para confirmar.');
    setLoading(true);
    try {
      await onDelete(password);
    } catch (e) {
      setError(authMessage(e));
      setLoading(false);
    }
  };

  return (
    <View style={[styles.group, { marginTop: 56 }]}>
      {!open ? (
        <Button label="Excluir conta" kind="danger" icon="trash" onPress={() => setOpen(true)} />
      ) : (
        <Plate style={{ padding: 16 }}>
          <T variant="bodyStrong">Excluir a conta para sempre</T>
          <T variant="callout" tone="ink2" style={{ marginTop: 8, marginBottom: 16 }}>
            Sua conta sai do servidor do Baiu, e os registros financeiros desta conta são apagados deste aparelho. Isso
            não pode ser desfeito. Se quiser uma cópia, exporte seus movimentos em Ajustes antes.
          </T>
          <PasswordField label="Sua senha" value={password} onChangeText={setPassword} placeholder="Para confirmar" />
          <FormError message={error} />
          <Button
            label="Excluir conta para sempre"
            kind="danger"
            loading={loading}
            onPress={() =>
              confirm('Excluir a conta?', 'Esta é a última confirmação. A exclusão não pode ser desfeita.', 'Excluir', run, true)
            }
          />
          <View style={{ marginTop: 8 }}>
            <Button
              label="Cancelar"
              kind="quiet"
              onPress={() => {
                setOpen(false);
                setPassword('');
                setError(null);
              }}
            />
          </View>
        </Plate>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  group: { marginTop: 24, paddingHorizontal: gutter },
  groupTitle: { marginBottom: 8, marginLeft: 4 },
});
