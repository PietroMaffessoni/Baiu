import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AuthScreen, FormError, FormNote } from '@/components/auth-form';
import { Button } from '@/components/button';
import { AuthFailure, authMessage } from '@/lib/auth';
import { cleanCode, OTP_LENGTH } from '@/lib/auth/validation';
import { useAuth } from '@/store/auth';
import { T } from '@/theme/text';
import { color, font } from '@/theme/tokens';

const RESEND_AFTER = 60;

/** Confirma o e-mail do cadastro com o código de 6 dígitos. */
export default function VerificarEmail() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { verifySignUp, resendSignUp } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER);
  const tried = useRef<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async (value = code) => {
    if (value.length !== OTP_LENGTH) {
      setError(`Digite os ${OTP_LENGTH} números do código.`);
      return;
    }
    tried.current = value;
    setLoading(true);
    setError(null);
    try {
      await verifySignUp(email, value);
      // a navegação muda sozinha: a conta entrou
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      await resendSignUp(email);
      setNotice('Enviamos um código novo. Ele pode levar alguns minutos para chegar.');
      setWait(RESEND_AFTER);
    } catch (e) {
      setError(e instanceof AuthFailure && e.code === 'rate_limited' ? 'Espere um minuto antes de pedir outro código.' : authMessage(e));
    }
  };

  return (
    <AuthScreen
      title="Confirme seu e-mail"
      subtitle={`Enviamos um código de ${OTP_LENGTH} números para ${email}. Ele vale por uma hora.`}>
      <TextInput
        value={code}
        onChangeText={(t) => {
          const c = cleanCode(t);
          setCode(c);
          setError(null);
          if (c.length === OTP_LENGTH && c !== tried.current) verify(c);
        }}
        placeholder={'0'.repeat(OTP_LENGTH)}
        placeholderTextColor={color.plateHi}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        autoFocus
        selectionColor={color.lantern}
        keyboardAppearance="dark"
        style={[styles.code, error && { borderColor: color.vermilion }]}
        accessibilityLabel="Código de confirmação"
      />

      <FormError message={error} />
      {notice ? <FormNote tone="jade">{notice}</FormNote> : null}

      <Button label="Confirmar" onPress={() => verify()} loading={loading} disabled={code.length !== OTP_LENGTH} />

      <View style={{ marginTop: 12 }}>
        <Button
          label={wait > 0 ? `Reenviar código em ${wait}s` : 'Reenviar código'}
          kind="quiet"
          disabled={wait > 0}
          onPress={resend}
        />
      </View>

      <View style={styles.help}>
        <T variant="caption" tone="ink3">
          Não chegou? Confira a caixa de spam e as promoções.
        </T>
        <T variant="caption" tone="ink3">
          Se este e-mail já tiver conta no Baiu, nenhum código é enviado.{' '}
          <T variant="captionStrong" tone="lantern" onPress={() => router.replace('/entrar')} accessibilityRole="link">
            Entre com sua senha
          </T>
          .
        </T>
        <T variant="caption" tone="ink3">
          Digitou o e-mail errado?{' '}
          <T variant="captionStrong" tone="lantern" onPress={() => router.back()} accessibilityRole="link">
            Corrigir
          </T>
          .
        </T>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  code: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: color.plate,
    borderWidth: 1,
    borderColor: color.lineStrong,
    color: color.paper,
    fontFamily: font.bold,
    fontSize: 30,
    letterSpacing: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  help: { marginTop: 22, gap: 8 },
});
