import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInputInstance } from 'react-native';

import { AuthScreen, Field, FormError, FormNote, PasswordField } from '@/components/auth-form';
import { Button } from '@/components/button';
import { AuthFailure, authMessage } from '@/lib/auth';
import { checkEmail, normalizeEmail } from '@/lib/auth/validation';
import { useAuth } from '@/store/auth';
import { T } from '@/theme/text';

/** Depois de tantas senhas erradas seguidas, o botão espera um pouco. */
const MAX_TRIES = 5;
const COOLDOWN = 30;

export default function Entrar() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { signIn, resendSignUp, configured } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [wait, setWait] = useState(0);
  const passRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const emailC = checkEmail(email);

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!emailC.ok) return;
    if (!password) {
      setError('Digite sua senha.');
      return;
    }
    setLoading(true);
    try {
      await signIn(emailC.email, password);
      // a navegação muda sozinha: a conta entrou
    } catch (e) {
      if (e instanceof AuthFailure && e.code === 'email_not_confirmed') {
        await resendSignUp(emailC.email).catch(() => {});
        router.push({ pathname: '/verificar-email', params: { email: emailC.email } });
        return;
      }
      if (e instanceof AuthFailure && e.code === 'invalid_credentials') {
        const n = fails + 1;
        setFails(n);
        if (n >= MAX_TRIES) {
          setFails(0);
          setWait(COOLDOWN);
          setError(`Muitas tentativas erradas. Espere ${COOLDOWN} segundos ou recupere sua senha.`);
          return;
        }
      }
      setError(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen title="Entrar" subtitle="Use o e-mail e a senha da sua conta Baiu.">
      {!configured ? (
        <FormNote>O serviço de contas ainda não foi configurado neste build. O login não vai funcionar.</FormNote>
      ) : null}
      <Field
        label="E-mail"
        value={email}
        onChangeText={(t) => setEmail(t.replace(/\s/g, ''))}
        onBlur={() => {
          setEmail(normalizeEmail(email));
          setTouched(true);
        }}
        placeholder="nome@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
        error={touched && !emailC.ok ? emailC.error : null}
      />
      <PasswordField
        ref={passRef}
        label="Senha"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        placeholder="Sua senha"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Pressable
        onPress={() => router.push({ pathname: '/recuperar-senha', params: { email: emailC.email } })}
        style={styles.forgot}
        accessibilityRole="link"
        hitSlop={8}>
        <T variant="calloutStrong" tone="lantern">
          Esqueci minha senha
        </T>
      </Pressable>

      <FormError message={error} />
      <Button
        label={wait > 0 ? `Tente de novo em ${wait}s` : 'Entrar'}
        onPress={submit}
        loading={loading}
        disabled={wait > 0}
      />

      <Pressable onPress={() => router.replace('/cadastro')} style={styles.switch} accessibilityRole="link" hitSlop={8}>
        <T variant="callout" tone="ink2">
          Ainda não tem conta?{' '}
          <T variant="calloutStrong" tone="lantern">
            Criar conta
          </T>
        </T>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 18, paddingVertical: 4 },
  switch: { alignSelf: 'center', marginTop: 22, paddingVertical: 6 },
});
