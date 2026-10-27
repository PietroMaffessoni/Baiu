import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Plate } from '@/components/layout';
import { BANK_MESSAGES, BankFailure, bankBackend } from '@/lib/bank/client';
import { CATEGORIES, CONSENT_STATUS, PURPOSES, TERM } from '@/lib/bank/consent-text';
import type { ConsentRecord } from '@/lib/bank/types';
import { useBank } from '@/lib/bank/use-bank';
import { MESES } from '@/lib/dates';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

const fullDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

/**
 * Detalhe de uma autorização do Open Finance: prazo, finalidade e categorias
 * compartilhadas, com a opção de cancelar. Depois de cancelada, continua
 * aqui no histórico, só com a situação e a data atualizadas.
 */
export default function Autorizacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const { unlink } = useBank();
  const [record, setRecord] = useState<ConsentRecord | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const local = state.bank.items.some((i) => i.id === id);

  const load = useCallback(
    () =>
      bankBackend
        .history()
        .then((list) => setRecord(list.find((c) => c.id === id) ?? null))
        .catch((e) => setError(BANK_MESSAGES[e instanceof BankFailure ? e.code : 'unknown'])),
    [id],
  );
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const revoke = async (keep: boolean) => {
    setBusy(true);
    setError(null);
    try {
      // banco que está no app: tira dele também (mantendo ou apagando os dados); pendente: só cancela
      if (local) await unlink(id, keep);
      else await bankBackend.unlink(id);
      setConfirm(false);
      await load();
    } catch (e) {
      setError(BANK_MESSAGES[e instanceof BankFailure ? e.code : 'unknown']);
    } finally {
      setBusy(false);
    }
  };

  if (record === undefined && !error) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={color.lantern} />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={[styles.screen, { padding: gutter }]}>
        <T variant="callout" tone={error ? 'vermilion' : 'ink2'}>
          {error ?? 'Essa autorização não foi encontrada.'}
        </T>
      </View>
    );
  }

  const st = CONSENT_STATUS[record.status] ?? { label: record.status, tone: 'ink3' as const };
  const active = record.status !== 'cancelada' && record.status !== 'recusada';

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: gutter, paddingBottom: insets.bottom + 40, gap: 16 }}>
      <View style={{ gap: 4 }}>
        <T variant="title2">{record.name}</T>
        <T variant="callout" tone={st.tone}>
          {st.label}
        </T>
      </View>

      <Plate style={styles.plate}>
        <Row label="Autorizada em" value={fullDate(record.createdAt)} />
        <Row label="Prazo" value={record.revokedAt ? `Encerrada em ${fullDate(record.revokedAt)}` : TERM} />
        <Row label="Quem recebe os dados" value="Celcoin Instituição de Pagamento, com a Polp, a pedido do Baiu" />
      </Plate>

      <View style={{ gap: 8 }}>
        <T variant="title3">Dados compartilhados</T>
        {record.products.map((p) => (
          <View key={p} style={{ gap: 2 }}>
            <T variant="calloutStrong">{CATEGORIES[p]?.label ?? p}</T>
            {CATEGORIES[p] ? (
              <T variant="caption" tone="ink2">
                {CATEGORIES[p].details}
              </T>
            ) : null}
          </View>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <T variant="title3">Finalidade do Compartilhamento</T>
        {PURPOSES.map((p) => (
          <View key={p} style={styles.bullet}>
            <View style={styles.dot} />
            <T variant="callout" style={{ flex: 1 }}>
              {p}
            </T>
          </View>
        ))}
      </View>

      {error ? (
        <T variant="callout" tone="vermilion">
          {error}
        </T>
      ) : null}

      {active && !confirm ? (
        <Button label="Cancelar autorização" kind="danger" onPress={() => setConfirm(true)} />
      ) : null}
      {active && confirm ? (
        <Plate style={styles.plate}>
          <T variant="callout">
            {`Cancelar a autorização interrompe o compartilhamento de dados de ${record.name} pelo Open Finance. O Baiu deixa de receber saldos e movimentos desse banco.`}
          </T>
          {local ? (
            <>
              <Button
                label="Cancelar e manter os dados no Baiu"
                kind="secondary"
                onPress={() => revoke(true)}
                loading={busy}
              />
              <Button label="Cancelar e apagar os dados" kind="danger" onPress={() => revoke(false)} disabled={busy} />
            </>
          ) : (
            <Button label="Cancelar autorização" kind="danger" onPress={() => revoke(true)} loading={busy} />
          )}
          <Button label="Voltar" kind="quiet" onPress={() => setConfirm(false)} disabled={busy} />
        </Plate>
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T variant="caption" tone="ink3">
        {label}
      </T>
      <T variant="callout">{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  plate: { padding: 14, gap: 12 },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.lantern, marginTop: 7 },
});
