import { router } from 'expo-router';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { passwordRules, passwordStrength, STRENGTH_LABEL } from '@/lib/auth/validation';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';
import { Icon } from './icon';
import { tick } from './keypad';

/** Tela de formulário de conta: rola, foge do teclado e tem o "Voltar" no topo. */
export function AuthScreen({
  title,
  subtitle,
  children,
  back = true,
  onBack,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: gutter }}>
        {back ? (
          <Pressable
            onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/boas-vindas'))}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Voltar">
            <Icon name="back" size={18} tint={color.lantern} weight="semibold" />
            <T variant="body" tone="lantern">
              Voltar
            </T>
          </Pressable>
        ) : (
          <View style={{ height: 36 }} />
        )}
        <T variant="title1" accessibilityRole="header" style={{ marginTop: 12 }}>
          {title}
        </T>
        {subtitle ? (
          <T variant="callout" tone="ink2" style={{ marginTop: 6 }}>
            {subtitle}
          </T>
        ) : null}
        <View style={{ marginTop: 22 }}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  right?: ReactNode;
};

/** Campo com rótulo, borda vermelha e mensagem quando há erro. */
export const Field = forwardRef<TextInputInstance, FieldProps>(function Field(
  { label, error, hint, right, style, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <T variant="captionStrong" tone="ink2" style={styles.label}>
        {label}
      </T>
      <View style={[styles.inputWrap, focused && styles.inputFocused, !!error && styles.inputError]}>
        <TextInput
          ref={ref}
          placeholderTextColor={color.ink3}
          selectionColor={color.lantern}
          keyboardAppearance="dark"
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.msg} accessibilityLiveRegion="polite">
          <Icon name="warning" size={14} tint={color.vermilion} />
          <T variant="caption" tone="vermilion" style={{ flex: 1 }}>
            {error}
          </T>
        </View>
      ) : hint ? (
        <View style={styles.msg}>{typeof hint === 'string' ? <T variant="caption" tone="ink3">{hint}</T> : hint}</View>
      ) : null}
    </View>
  );
});

/** Campo de senha com o olho para mostrar o que foi digitado. */
export const PasswordField = forwardRef<TextInputInstance, FieldProps & { isNew?: boolean }>(function PasswordField(
  { isNew, ...props },
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <Field
      ref={ref}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      textContentType={isNew ? 'newPassword' : 'password'}
      autoComplete={isNew ? 'new-password' : 'current-password'}
      passwordRules={isNew ? 'minlength: 8; required: lower; required: upper; required: digit; required: special;' : undefined}
      maxLength={72}
      {...props}
      right={
        <Pressable
          onPress={() => setShow((v) => !v)}
          hitSlop={10}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={show ? 'Esconder a senha' : 'Mostrar a senha'}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={20} tint={color.ink2} />
        </Pressable>
      }
    />
  );
});

/** Regras da senha marcadas ao vivo, mais a barra de força. */
export function PasswordChecklist({
  password,
  personal,
  problem,
}: {
  password: string;
  personal: { email?: string; name?: string };
  problem?: string | null;
}) {
  const rules = passwordRules(password);
  const strength = passwordStrength(password, personal);
  const barColor = strength >= 4 ? color.jade : strength === 3 ? color.lantern : color.vermilion;
  return (
    <View style={styles.checklist} accessible accessibilityLabel={`Força da senha: ${STRENGTH_LABEL[strength] || 'vazia'}`}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: password && i <= strength ? barColor : color.plateHi }]} />
        ))}
        <T variant="captionStrong" style={{ color: password ? barColor : color.ink3, minWidth: 44, textAlign: 'right' }}>
          {password ? STRENGTH_LABEL[strength] : ''}
        </T>
      </View>
      {rules.map((r) => (
        <View key={r.key} style={styles.rule}>
          <Icon name={r.ok ? 'check' : 'close'} size={13} tint={r.ok ? color.jade : color.ink3} weight="semibold" />
          <T variant="caption" tone={r.ok ? 'ink2' : 'ink3'}>
            {r.label}
          </T>
        </View>
      ))}
      {problem ? (
        <View style={styles.rule} accessibilityLiveRegion="polite">
          <Icon name="warning" size={13} tint={color.vermilion} />
          <T variant="caption" tone="vermilion" style={{ flex: 1 }}>
            {problem}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** Caixa de marcar com texto que pode ter links. */
export function Check({
  checked,
  onChange,
  children,
  error,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  error?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onChange(!checked);
      }}
      style={styles.check}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={6}>
      <View style={[styles.box, checked && styles.boxOn, error && !checked && styles.boxError]}>
        {checked ? <Icon name="check" size={14} tint={color.night} weight="semibold" /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** Aviso de erro geral do formulário, acima do botão. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.formError} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <Icon name="warning" size={16} tint={color.vermilion} />
      <T variant="callout" tone="vermilion" style={{ flex: 1 }}>
        {message}
      </T>
    </View>
  );
}

/** Aviso neutro (informação ou sucesso). */
export function FormNote({ children, tone = 'ink2' }: { children: ReactNode; tone?: 'ink2' | 'jade' }) {
  return (
    <View style={[styles.note, tone === 'jade' && styles.noteOk]}>
      <Icon name={tone === 'jade' ? 'check' : 'info'} size={16} tint={tone === 'jade' ? color.jade : color.ink2} />
      <T variant="callout" tone={tone} style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 36 },
  field: { marginBottom: 16 },
  label: { marginBottom: 8, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: color.plate,
    borderWidth: 1,
    borderColor: color.line,
  },
  inputFocused: { borderColor: color.lantern },
  inputError: { borderColor: color.vermilion },
  input: { flex: 1, minHeight: 50, paddingHorizontal: 14, color: color.paper, fontSize: 16 },
  eye: { paddingHorizontal: 14, minHeight: 50, justifyContent: 'center' },
  msg: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6, marginLeft: 2 },
  checklist: { marginTop: -6, marginBottom: 18, gap: 5 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  bar: { flex: 1, height: 5, borderRadius: radius.pill },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: color.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: color.lantern, borderColor: color.lantern },
  boxError: { borderColor: color.vermilion },
  formError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: color.vermilionWash,
    borderWidth: 1,
    borderColor: 'rgba(242, 87, 60, 0.4)',
    marginBottom: 16,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    marginBottom: 16,
  },
  noteOk: { backgroundColor: 'rgba(94, 214, 167, 0.1)', borderColor: 'rgba(94, 214, 167, 0.3)' },
});
