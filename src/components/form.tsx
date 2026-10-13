import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bankById } from '@/data/banks';
import { CATEGORY } from '@/data/categories';
import type { Account, Category } from '@/data/types';
import { addDays, daysBetween, MESES_CURTOS, startOfDay } from '@/lib/dates';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';
import { BankMark } from './bank-mark';
import { Icon, type IconName } from './icon';
import { tick } from './keypad';

/** Cabeçalho de modal: ação à esquerda, progresso ou título no meio, ação opcional à direita. */
export function ModalHeader({
  left,
  right,
  title,
  step,
}: {
  left: { label: string; onPress: () => void };
  right?: { label: string; onPress: () => void; disabled?: boolean };
  title?: string;
  step?: { index: number; total: number };
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 10 : insets.top + 6 }]}>
      <Pressable onPress={left.onPress} hitSlop={10} style={styles.headerBtn} accessibilityRole="button">
        <T variant="body" tone="lantern">
          {left.label}
        </T>
      </Pressable>
      {step ? (
        <View style={styles.dots} accessible accessibilityLabel={`Passo ${step.index + 1} de ${step.total}`}>
          {Array.from({ length: step.total }, (_, i) => (
            <View key={i} style={[styles.dot, i <= step.index && styles.dotOn, i === step.index && styles.dotNow]} />
          ))}
        </View>
      ) : title ? (
        <T variant="title3" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </T>
      ) : (
        <View />
      )}
      {right ? (
        <Pressable
          onPress={right.onPress}
          disabled={right.disabled}
          hitSlop={10}
          style={[styles.headerBtn, { alignItems: 'flex-end' }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!right.disabled }}>
          <T variant="bodyStrong" tone={right.disabled ? 'ink3' : 'lantern'}>
            {right.label}
          </T>
        </Pressable>
      ) : (
        <View style={styles.headerBtn} />
      )}
    </View>
  );
}

export function FieldLabel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.label, style]}>
      <T variant="captionStrong" tone="ink2">
        {children}
      </T>
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={color.ink3}
      selectionColor={color.lantern}
      keyboardAppearance="dark"
      maxLength={60}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

/** Pílulas de escolha única. Selecionada fica âmbar cheia. */
export function Chips<V extends string | number>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  scroll?: boolean;
}) {
  const body = options.map((o) => {
    const on = o.value === value;
    return (
      <Pressable
        key={String(o.value)}
        onPress={() => {
          tick();
          onChange(o.value);
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        style={[styles.chip, on && styles.chipOn]}>
        <T variant="calloutStrong" style={{ color: on ? color.night : color.paper }}>
          {o.label}
        </T>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowScroll}>
        {body}
      </ScrollView>
    );
  }
  return <View style={styles.chipRow}>{body}</View>;
}

/** Controle segmentado em pílula, como o filtro do extrato. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tick();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segBtn, on && styles.segOn]}>
            <T variant="calloutStrong" style={{ color: on ? color.night : color.ink2 }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Escolha de conta: monograma e nome, em faixa horizontal. */
export function AccountChips({
  accounts,
  value,
  onChange,
  extra,
}: {
  accounts: Account[];
  value: string | null;
  onChange: (id: string) => void;
  extra?: { id: string; label: string };
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowScroll}>
      {extra && (
        <Pressable
          onPress={() => {
            tick();
            onChange(extra.id);
          }}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === extra.id }}
          style={[styles.accChip, value === extra.id && styles.accChipOn]}>
          <T variant="calloutStrong" style={{ color: value === extra.id ? color.night : color.paper }}>
            {extra.label}
          </T>
        </Pressable>
      )}
      {accounts.map((a) => {
        const on = a.id === value;
        return (
          <Pressable
            key={a.id}
            onPress={() => {
              tick();
              onChange(a.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={a.nickname ?? bankById(a.bankId).name}
            style={[styles.accChip, on && styles.accChipOn]}>
            <BankMark bankId={a.bankId} size={24} />
            <T
              variant="calloutStrong"
              numberOfLines={1}
              style={{ color: on ? color.night : color.paper, maxWidth: 150 }}>
              {a.nickname ?? bankById(a.bankId).name}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Grade de categorias: glifo redondo e rótulo. */
export function CategoryGrid({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: Category | null;
  onChange: (c: Category) => void;
}) {
  return (
    <View style={styles.grid}>
      {categories.map((c) => {
        const on = c === value;
        return (
          <Pressable
            key={c}
            onPress={() => {
              tick();
              onChange(c);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={CATEGORY[c].label}
            style={styles.gridCell}>
            <View style={[styles.gridGlyph, on && styles.gridGlyphOn]}>
              <Icon name={CATEGORY[c].icon} size={20} tint={on ? color.night : color.ink2} />
            </View>
            <T variant="micro" tone={on ? 'paper' : 'ink3'} align="center" numberOfLines={2}>
              {CATEGORY[c].label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const shortDate = (d: Date) =>
  `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;

/** Data com atalhos (hoje, ontem ou amanhã) e o seletor nativo para o resto. */
export function DateField({ value, onChange, future }: { value: Date; onChange: (d: Date) => void; future?: boolean }) {
  const [inline, setInline] = useState(false);
  const today = startOfDay(new Date());
  const quick = future
    ? [
        { key: 0, label: 'Hoje' },
        { key: 1, label: 'Amanhã' },
        { key: 7, label: 'Em 7 dias' },
      ]
    : [
        { key: 0, label: 'Hoje' },
        { key: -1, label: 'Ontem' },
      ];
  const offset = daysBetween(today, value);
  const isQuick = quick.some((q) => q.key === offset);

  // hoje usa a hora atual (ordena certo no extrato); outros dias ficam ao meio-dia
  const set = (d: Date) => {
    if (!future && daysBetween(today, d) === 0) return onChange(new Date());
    const out = new Date(d);
    out.setHours(12, 0, 0, 0);
    onChange(out);
  };

  const openPicker = () => {
    tick();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        maximumDate: future ? undefined : new Date(),
        onValueChange: (_e, d) => set(d),
      });
    } else setInline((v) => !v);
  };

  return (
    <View>
      <View style={styles.chipRow}>
        {quick.map((q) => {
          const on = q.key === offset;
          return (
            <Pressable
              key={q.key}
              onPress={() => {
                tick();
                setInline(false);
                set(addDays(today, q.key));
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.chip, on && styles.chipOn]}>
              <T variant="calloutStrong" style={{ color: on ? color.night : color.paper }}>
                {q.label}
              </T>
            </Pressable>
          );
        })}
        {Platform.OS !== 'web' && (
          <Pressable
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel="Escolher outra data"
            style={[styles.chip, !isQuick && styles.chipOn]}>
            <Icon name="calendar" size={15} tint={!isQuick ? color.night : color.paper} />
            <T variant="calloutStrong" style={{ color: !isQuick ? color.night : color.paper }}>
              {isQuick ? 'Outra data' : shortDate(value)}
            </T>
          </Pressable>
        )}
      </View>
      {inline && Platform.OS === 'ios' && (
        <DateTimePicker
          value={value}
          mode="date"
          display="inline"
          themeVariant="dark"
          accentColor={color.lantern}
          locale="pt-BR"
          maximumDate={future ? undefined : new Date()}
          onValueChange={(_e, d) => set(d)}
        />
      )}
    </View>
  );
}

/** Linha de lista com ícone, rótulo e valor ou controle à direita. */
export function ListRow({
  icon,
  label,
  hint,
  value,
  onPress,
  chevron,
  tone = 'paper',
  children,
}: {
  icon?: IconName;
  label: string;
  hint?: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  tone?: 'paper' | 'vermilion' | 'lantern';
  children?: ReactNode;
}) {
  const body = (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={19} tint={tone === 'paper' ? color.ink2 : color[tone]} /> : null}
      <View style={{ flex: 1 }}>
        <T variant="body" tone={tone}>
          {label}
        </T>
        {hint ? (
          <T variant="caption" tone="ink3">
            {hint}
          </T>
        ) : null}
      </View>
      {value ? (
        <T variant="callout" tone="ink2" tabular>
          {value}
        </T>
      ) : null}
      {children}
      {chevron ? <Icon name="chevron" size={13} tint={color.ink3} weight="semibold" /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }} accessibilityRole="button">
      {body}
    </Pressable>
  );
}

/** Placa vazia que convida a primeira ação. */
export function EmptyPlate({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <T variant="callout" tone="ink2">
        {text}
      </T>
      {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter - 4,
    minHeight: 48,
    marginBottom: 8,
    gap: 8,
  },
  headerBtn: { minWidth: 72, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: color.plateHi },
  dotOn: { backgroundColor: 'rgba(255, 182, 72, 0.45)' },
  dotNow: { backgroundColor: color.lantern, width: 28 },
  label: { marginTop: 22, marginBottom: 8 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    color: color.paper,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRowScroll: { gap: 8, paddingRight: gutter },
  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  chipOn: { backgroundColor: color.lantern, borderColor: color.lantern },
  accChip: {
    minHeight: 44,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  accChipOn: { backgroundColor: color.lantern, borderColor: color.lantern },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  gridCell: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  gridGlyph: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  gridGlyphOn: { backgroundColor: color.lantern, borderColor: color.lantern },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 10 },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  segBtn: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segOn: { backgroundColor: color.lantern },
  empty: {
    padding: 16,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 182, 72, 0.35)',
  },
});
