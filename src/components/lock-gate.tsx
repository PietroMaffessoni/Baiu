import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authenticate, lockInfo } from '@/lib/lock';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';
import { Baiu } from './baiu/baiu';
import { Button } from './button';
import { Wordmark } from './wordmark';

const RELOCK_AFTER_MS = 30_000;

/** Enquanto verdadeiro, a cortina não cobre a tela (prompts do sistema deixam o app inativo). */
let holdCurtain = 0;
export async function withoutCurtain<T>(fn: () => Promise<T>): Promise<T> {
  holdCurtain++;
  try {
    return await fn();
  } finally {
    setTimeout(() => {
      holdCurtain = Math.max(0, holdCurtain - 1);
    }, 600);
  }
}

/**
 * Bloqueio por Face ID, digital ou código, e cortina de privacidade:
 * no seletor de apps o sistema fotografa a tela, então ela é coberta antes.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const enabled = state.settings.lock;
  const [locked, setLocked] = useState(enabled);
  const [curtain, setCurtain] = useState(false);
  const leftAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await withoutCurtain(() => authenticate('Desbloquear o Baiu'));
    prompting.current = false;
    if (ok) setLocked(false);
  }, []);

  // desligar o bloqueio em Ajustes destrava na hora
  const showLock = enabled && locked;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        leftAt.current = Date.now();
        setCurtain(true);
      } else if (s === 'inactive') {
        if (Platform.OS === 'ios' && holdCurtain === 0 && !prompting.current) setCurtain(true);
      } else if (s === 'active') {
        setCurtain(false);
        if (enabled && leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // pede a biometria assim que a tela de bloqueio aparece
  useEffect(() => {
    if (!showLock || AppState.currentState !== 'active' || prompting.current) return;
    let alive = true;
    prompting.current = true;
    withoutCurtain(() => authenticate('Desbloquear o Baiu')).then((ok) => {
      prompting.current = false;
      if (alive && ok) setLocked(false);
    });
    return () => {
      alive = false;
    };
  }, [showLock]);

  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        accessibilityElementsHidden={showLock}
        importantForAccessibility={showLock ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {showLock && <LockScreen onUnlock={unlock} />}
      {curtain && !showLock && (
        <View style={[StyleSheet.absoluteFill, styles.curtain]} pointerEvents="none">
          <Wordmark width={112} />
        </View>
      )}
    </View>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const folego = useFolego();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState('Face ID');
  useEffect(() => {
    lockInfo().then((i) => setMethod(i.method));
  }, []);
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.lock,
        { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
      ]}>
      <View style={{ alignItems: 'center' }}>
        <Baiu score={folego.score} width={176} still />
        <T variant="title2" align="center" style={{ marginTop: 18 }} accessibilityRole="header">
          Baiu bloqueado
        </T>
        <T variant="callout" tone="ink2" align="center" style={{ marginTop: 6 }}>
          Use {method} para ver suas finanças.
        </T>
      </View>
      <Button label="Desbloquear" icon="faceid" onPress={onUnlock} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  curtain: { backgroundColor: color.night, alignItems: 'center', justifyContent: 'center' },
  lock: { backgroundColor: color.night, paddingHorizontal: gutter, justifyContent: 'space-between' },
});
