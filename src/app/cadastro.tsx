import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { AuthScreen, Check, Field, FormError, FormNote, PasswordChecklist, PasswordField } from '@/components/auth-form';
import { Button } from '@/components/button';
import { authMessage, PRIVACY_VERSION, TERMS_VERSION } from '@/lib/auth';
import {
  checkEmail,
  checkName,
  checkPassword,
  checkPhone,
  formatName,
  formatPhone,
  normalizeEmail,
  passwordProblem,
} from '@/lib/auth/validation';
import { useAuth } from '@/store/auth';
import { T } from '@/theme/text';

type Key = 'name' | 'email' | 'phone' | 'password';

export default function Cadastro() {
  const { signUp, configured } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [touched, setTouched] = useState<Record<Key, boolean>>({ name: false, email: false, phone: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  /** Sugestão de e-mail que a pessoa viu e decidiu manter como digitou. */
  const [keptEmail, setKeptEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const nameC = checkName(name);
  const emailC = checkEmail(email);
  const phoneC = checkPhone(phone);
  const personal = { email: emailC.email, name: nameC.ok ? nameC.name : name };
  const passC = checkPassword(password, personal);
  const suggestion = emailC.suggestion && emailC.suggestion !== keptEmail ? emailC.suggestion : undefined;

  const show = (k: Key) => touched[k] || submitted;
  const touch = (k: Key) => setTouched((t) => ({ ...t, [k]: true }));

  const submit = async () => {
    setSubmitted(true);
    setFormError(null);
    if (!nameC.ok || !emailC.ok || !phoneC.ok || !passC.ok) {
      setFormError('Confira os campos marcados em vermelho.');
      return;
    }
    if (suggestion) {
      setFormError('Confira o e-mail: parece haver um erro de digitação no provedor.');
      return;
    }
    if (!terms || !adult) {
      setFormError('Para criar a conta, marque as duas confirmações no fim do formulário.');
      return;
    }
    setLoading(true);
    try {
      await signUp({
        email: emailC.email,
        password,
        fullName: nameC.name,
        phone: phoneC.e164,
        consent: { terms: TERMS_VERSION, privacy: PRIVACY_VERSION, adult: true },
      });
      router.push({ pathname: '/verificar-email', params: { email: emailC.email } });
    } catch (e) {
      setFormError(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen title="Criar conta" subtitle="Leva um minuto. Depois, confirmamos seu e-mail com um código.">
      {!configured ? (
        <FormNote>O serviço de contas ainda não foi configurado neste build. O cadastro não vai funcionar.</FormNote>
      ) : null}

      <Field
        label="Nome completo"
        value={name}
        onChangeText={setName}
        onBlur={() => {
          setName(formatName(name));
          touch('name');
        }}
        placeholder="Ex.: Maria da Silva"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={80}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        error={show('name') && !nameC.ok ? nameC.error : null}
      />

      <Field
        ref={emailRef}
        label="E-mail"
        value={email}
        onChangeText={(t) => setEmail(t.replace(/\s/g, ''))}
        onBlur={() => {
          setEmail(normalizeEmail(email));
          touch('email');
        }}
        placeholder="nome@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        error={show('email') && !emailC.ok ? emailC.error : null}
        hint={
          show('email') && (suggestion || (!emailC.ok && emailC.suggestion)) ? (
            <Suggestion
              value={(suggestion ?? emailC.suggestion)!}
              onUse={() => {
                setEmail((suggestion ?? emailC.suggestion)!);
                setFormError(null);
              }}
              onKeep={emailC.ok ? () => setKeptEmail(emailC.suggestion!) : undefined}
            />
          ) : (
            'Você vai usar este e-mail para entrar e recuperar a senha.'
          )
        }
      />

      <Field
        ref={phoneRef}
        label="Celular com DDD"
        value={phone}
        onChangeText={(t) => setPhone(formatPhone(t))}
        onBlur={() => touch('phone')}
        placeholder="(11) 98765-4321"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={16}
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
        error={show('phone') && !phoneC.ok ? phoneC.error : null}
        hint="Só para falar com você sobre a sua conta, se precisar."
      />

      <PasswordField
        ref={passRef}
        isNew
        label="Senha"
        value={password}
        onChangeText={setPassword}
        onBlur={() => touch('password')}
        placeholder="Crie uma senha forte"
        returnKeyType="done"
        error={show('password') && !passC.ok && !password ? passC.error : null}
      />
      <PasswordChecklist
        password={password}
        personal={personal}
        problem={password.length > 0 && (show('password') || password.length >= 8) ? passwordProblem(password, personal) : null}
      />

      <View style={{ marginTop: 4, marginBottom: 14 }}>
        <Check checked={terms} onChange={setTerms} error={submitted} label="Li e aceito os Termos de uso e a Política de privacidade">
          <T variant="callout">
            Li e aceito os{' '}
            <T variant="calloutStrong" tone="lantern" onPress={() => router.push('/termos')} accessibilityRole="link">
              Termos de uso
            </T>{' '}
            e a{' '}
            <T variant="calloutStrong" tone="lantern" onPress={() => router.push('/privacidade')} accessibilityRole="link">
              Política de privacidade
            </T>
            .
          </T>
        </Check>
        <Check checked={adult} onChange={setAdult} error={submitted} label="Tenho 18 anos ou mais">
          <T variant="callout">Tenho 18 anos ou mais.</T>
        </Check>
      </View>

      <FormError message={formError} />
      <Button label="Criar conta" onPress={submit} loading={loading} />

      <T variant="caption" tone="ink3" align="center" style={{ marginTop: 14 }}>
        Seus registros financeiros ficam só neste aparelho, criptografados. No servidor ficam apenas nome, e-mail e
        celular, para manter sua conta.
      </T>

      <Pressable
        onPress={() => router.replace('/entrar')}
        style={styles.switch}
        accessibilityRole="link"
        hitSlop={8}>
        <T variant="callout" tone="ink2">
          Já tem conta?{' '}
          <T variant="calloutStrong" tone="lantern">
            Entrar
          </T>
        </T>
      </Pressable>
    </AuthScreen>
  );
}

function Suggestion({ value, onUse, onKeep }: { value: string; onUse: () => void; onKeep?: () => void }) {
  return (
    <View style={{ flex: 1, gap: 6 }} accessibilityLiveRegion="polite">
      <T variant="caption" tone="lantern">
        Você quis dizer <T variant="captionStrong" tone="lantern">{value}</T>?
      </T>
      <View style={{ flexDirection: 'row', gap: 18 }}>
        <T variant="captionStrong" tone="lantern" onPress={onUse} accessibilityRole="button">
          Usar este
        </T>
        {onKeep ? (
          <T variant="captionStrong" tone="ink2" onPress={onKeep} accessibilityRole="button">
            Está certo como digitei
          </T>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  switch: { alignSelf: 'center', marginTop: 22, paddingVertical: 6 },
});
