import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthScreen, Field, FormError, FormNote, PasswordChecklist, PasswordField } from '@/components/auth-form';
import { Button } from '@/components/button';
import { AuthFailure, authMessage } from '@/lib/auth';
import { checkEmail, checkPassword, cleanCode, normalizeEmail, OTP_LENGTH, passwordProblem } from '@/lib/auth/validation';
import { useAuth } from '@/store/auth';

const RESEND_AFTER = 60;

/**
 * Esqueci a senha: e-mail, depois código + senha nova numa tela só.
 * A resposta é a mesma com ou sem conta, para não revelar quem usa o Baiu.
 */
export default function RecuperarSenha() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { requestReset, verifyReset, finishReset, cancelReset, recovering } = useAuth();
  const [step, setStep] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const emailC = checkEmail(email);
  const personal = { email: emailC.email };
  const passC = checkPassword(password, personal);

  const send = async () => {
    setTouched(true);
    setError(null);
    if (!emailC.ok) return;
    setLoading(true);
    try {
      await requestReset(emailC.email);
      setStep('codigo');
      setWait(RESEND_AFTER);
    } catch (e) {
      setError(e instanceof AuthFailure && e.code === 'rate_limited' ? 'Espere um minuto antes de pedir outro código.' : authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!recovering && code.length !== OTP_LENGTH) {
      setError(`Digite os ${OTP_LENGTH} números do código.`);
      return;
    }
    if (!passC.ok) {
      setError(passC.error);
      return;
    }
    setLoading(true);
    try {
      // o código só pode ser usado uma vez: se já passou, falta só a senha
      if (!recovering) await verifyReset(emailC.email, code);
      await finishReset(password);
      // a navegação muda sozinha: a conta entrou com a senha nova
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const leave = async () => {
    if (recovering) await cancelReset();
    if (router.canGoBack()) router.back();
    else router.replace('/entrar');
  };

  if (step === 'email') {
    return (
      <AuthScreen title="Recuperar senha" subtitle="Enviamos um código para o e-mail da sua conta." onBack={leave}>
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
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={send}
          error={touched && !emailC.ok ? emailC.error : null}
        />
        <FormError message={error} />
        <Button label="Enviar código" onPress={send} loading={loading} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Crie uma senha nova"
      subtitle={`Se ${emailC.email} tiver conta no Baiu, o código chega em alguns minutos. Confira também o spam.`}
      onBack={leave}>
      {recovering ? <FormNote tone="jade">Código confirmado. Agora é só criar a senha nova.</FormNote> : null}
      {!recovering ? (
        <Field
          label="Código"
          value={code}
          onChangeText={(t) => {
            setCode(cleanCode(t));
            setError(null);
          }}
          placeholder={'0'.repeat(OTP_LENGTH)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
        />
      ) : null}
      <PasswordField
        isNew
        label="Senha nova"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        placeholder="Crie uma senha forte"
      />
      <PasswordChecklist
        password={password}
        personal={personal}
        problem={password.length >= 8 ? passwordProblem(password, personal) : null}
      />
      <FormError message={error} />
      <Button label="Salvar senha nova" onPress={save} loading={loading} />
      {!recovering ? (
        <View style={{ marginTop: 12 }}>
          <Button
            label={wait > 0 ? `Reenviar código em ${wait}s` : 'Reenviar código'}
            kind="quiet"
            disabled={wait > 0}
            onPress={send}
          />
        </View>
      ) : null}
    </AuthScreen>
  );
}
