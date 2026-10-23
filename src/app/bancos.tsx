import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankMark } from '@/components/bank-mark';
import { Button } from '@/components/button';
import { EmptyPlate } from '@/components/form';
import { Icon } from '@/components/icon';
import { Plate } from '@/components/layout';
import type { BankItem } from '@/data/types';
import { BANK_MESSAGES, BankFailure, bankBackend } from '@/lib/bank/client';
import { CONSENT_STATUS } from '@/lib/bank/consent-text';
import type { ConsentRecord } from '@/lib/bank/types';
import { agoLabel, shortDate } from '@/lib/dates';
import { useBank, useBankStatus } from '@/lib/bank/use-bank';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

const STATUS_LINE: Record<BankItem['status'], string> = {
  ok: 'Conectado',
  atualizando: 'Atualizando…',
  reconectar: 'Precisa reconectar',
  erro: 'Com problema no banco',
};

/**
 * Bancos conectados: é o "Portal" do Open Finance. Aqui a pessoa vê as
 * conexões, o histórico de todas as autorizações (inclusive canceladas) e
 * cancela quando quiser, sem depender do suporte.
 */
export default function Bancos() {
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const { syncNow } = useBank();
  const status = useBankStatus();
  const items = state.bank.items;
  const [history, setHistory] = useState<ConsentRecord[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    if (state.demo || !bankBackend.available) return;
    setHistoryError(null);
    bankBackend
      .history()
      .then(setHistory)
      .catch((e) => setHistoryError(BANK_MESSAGES[e instanceof BankFailure ? e.code : 'unknown']));
  }, [state.demo]);
  useFocusEffect(loadHistory);

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: gutter, paddingBottom: insets.bottom + 40, gap: 14 }}
      refreshControl={
        items.length ? (
          <RefreshControl refreshing={status.running} onRefresh={syncNow} tintColor={color.lantern} />
        ) : undefined
      }>
      <T variant="callout" tone="ink2">
        Os bancos conectados pelo Open Finance se atualizam sozinhos sempre que você abre o Baiu. Entradas e saídas
        aparecem aqui sem você digitar nada.
      </T>
      {status.error ? (
        <T variant="callout" tone="vermilion">
          {BANK_MESSAGES[status.error]}
        </T>
      ) : null}

      {items.length === 0 ? (
        <EmptyPlate text="Nenhum banco conectado ainda. Conecte o banco onde seu dinheiro entra e o Baiu faz o resto." />
      ) : (
        items.map((i) => <ItemCard key={i.id} item={i} onUnlinked={loadHistory} />)
      )}

      <Button
        label={items.length ? 'Conectar outro banco' : 'Conectar banco'}
        icon="plus"
        onPress={() => router.push('/conectar')}
      />

      {history && history.length ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <T variant="title3">Suas autorizações</T>
          <T variant="caption" tone="ink3">
            Todas as autorizações do Open Finance que você já deu, inclusive as canceladas. Toque para ver os detalhes ou
            cancelar.
          </T>
          <Plate style={{ paddingVertical: 4 }}>
            {history.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: '/autorizacao/[id]', params: { id: c.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.consent, pressed && { opacity: 0.6 }]}>
                <View style={{ flex: 1 }}>
                  <T variant="body">{c.name}</T>
                  <T variant="caption" tone={CONSENT_STATUS[c.status]?.tone ?? 'ink3'}>
                    {`${CONSENT_STATUS[c.status]?.label ?? c.status} · desde ${shortDate(c.createdAt)}${c.revokedAt ? ` · cancelada em ${shortDate(c.revokedAt)}` : ''}`}
                  </T>
                </View>
                <Icon name="chevron" size={13} tint={color.ink3} />
              </Pressable>
            ))}
          </Plate>
        </View>
      ) : null}
      {historyError ? (
        <T variant="caption" tone="vermilion">
          {`Não deu para carregar suas autorizações. ${historyError}`}
        </T>
      ) : null}
    </ScrollView>
  );
}

function ItemCard({ item, onUnlinked }: { item: BankItem; onUnlinked: () => void }) {
  const { state } = useStore();
  const { syncNow, unlink } = useBank();
  const [busy, setBusy] = useState<'refresh' | 'unlink' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accounts = state.accounts.filter((a) => a.link?.item === item.id).length;

  const doRefresh = async () => {
    setBusy('refresh');
    setError(null);
    await syncNow();
    setBusy(null);
  };

  const doUnlink = async (keep: boolean) => {
    setBusy('unlink');
    setError(null);
    try {
      await unlink(item.id, keep);
      onUnlinked();
    } catch (e) {
      setError(BANK_MESSAGES[e instanceof BankFailure ? e.code : 'unknown']);
      setBusy(null);
    }
  };

  return (
    <Plate style={styles.card}>
      <View style={styles.head}>
        <BankMark bankId={item.bankId} size={40} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{item.name}</T>
          <T
            variant="caption"
            tone={item.status === 'ok' ? 'ink3' : item.status === 'atualizando' ? 'lantern' : 'vermilion'}>
            {STATUS_LINE[item.status]} · atualizado {agoLabel(item.syncedAt)}
          </T>
          <T variant="caption" tone="ink3">
            {accounts} {accounts === 1 ? 'conta' : 'contas'} no Baiu
          </T>
        </View>
        {busy === 'refresh' ? <ActivityIndicator color={color.lantern} /> : null}
      </View>

      {error ? (
        <T variant="caption" tone="vermilion">
          {error}
        </T>
      ) : null}

      {confirm ? (
        <View style={{ gap: 8 }}>
          <T variant="callout">
            Cancelar a autorização interrompe o compartilhamento de dados de {item.name} pelo Open Finance. O que fazer
            com o que já está aqui?
          </T>
          <Button
            label="Desconectar e manter os dados"
            kind="secondary"
            onPress={() => doUnlink(true)}
            loading={busy === 'unlink'}
          />
          <Button
            label="Desconectar e apagar os dados"
            kind="danger"
            onPress={() => doUnlink(false)}
            disabled={busy === 'unlink'}
          />
          <Button label="Cancelar" kind="quiet" onPress={() => setConfirm(false)} disabled={busy === 'unlink'} />
        </View>
      ) : (
        <View style={styles.actions}>
          {item.status === 'reconectar' ? (
            <Button
              label="Reconectar"
              onPress={() => router.push({ pathname: '/conectar', params: { itemId: item.id } })}
            />
          ) : (
            <Button label="Atualizar agora" kind="secondary" onPress={doRefresh} disabled={busy !== null} />
          )}
          <Button label="Desconectar" kind="quiet" onPress={() => setConfirm(true)} disabled={busy !== null} />
        </View>
      )}
    </Plate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  card: { padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { gap: 4 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
});
