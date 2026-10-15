import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { BankWidget } from '@/components/bank-widget';
import { Button } from '@/components/button';
import { ModalHeader } from '@/components/form';
import { Icon, type IconName } from '@/components/icon';
import { Plate } from '@/components/layout';
import { BANK_MESSAGES, BankFailure, bankBackend } from '@/lib/bank/client';
import type { SyncSummary } from '@/lib/bank/merge';
import { useBank } from '@/lib/bank/use-bank';
import { close } from '@/lib/nav';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

type Step = 'intro' | 'widget' | 'buscando' | 'pronto' | 'erro';

/**
 * Conectar um banco pelo Open Finance. Primeiro o Baiu explica o que vai
 * acontecer e pede a autorização (LGPD); depois o widget da Pluggy leva a
 * pessoa ao app do banco; por fim o Baiu traz e organiza tudo.
 */
export default function Conectar() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const reconnect = typeof itemId === 'string' && itemId.length > 0;
  const { state } = useStore();
  const folego = useFolego();
  const insets = useSafeAreaInsets();
  const { syncNow } = useBank();
  const [step, setStep] = useState<Step>('intro');
  const [token, setToken] = useState<{ token: string; sandbox: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; summary: SyncSummary | null } | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setToken(await bankBackend.connectToken(reconnect ? itemId : undefined));
      setStep('widget');
    } catch (e) {
      setError(BANK_MESSAGES[e instanceof BankFailure ? e.code : 'unknown']);
    } finally {
      setBusy(false);
    }
  };

  const connected = async (id: string) => {
    setStep('buscando');
    try {
      const item = await bankBackend.link(id);
      const summary = await syncNow();
      setResult({ name: item.name, summary });
      setStep('pronto');
    } catch (e) {
      setError(BANK_MESSAGES[e instanceof BankFailure ? e.code : 'unknown']);
      setStep('erro');
    }
  };

  if (step === 'widget' && token) {
    return (
      <View style={{ flex: 1, backgroundColor: color.nightDeep }}>
        <BankWidget
          token={token.token}
          sandbox={token.sandbox}
          updateItem={reconnect ? itemId : undefined}
          onSuccess={connected}
          onError={(message) => {
            setError(message || 'O banco não completou a conexão. Tente de novo.');
            setStep('erro');
          }}
          onClose={() => setStep((s) => (s === 'widget' ? 'intro' : s))}
        />
      </View>
    );
  }

  if (state.demo || !bankBackend.available) {
    return (
      <View style={styles.screen}>
        <ModalHeader left={{ label: 'Fechar', onPress: close }} />
        <View style={styles.center}>
          <Baiu score={folego.score} width={130} still />
          <T variant="title2" align="center">
            {state.demo ? 'Conexão com bancos precisa de conta' : 'Conexão com bancos ainda não disponível'}
          </T>
          <T variant="callout" tone="ink2" align="center">
            {state.demo
              ? 'No modo exemplo os dados são de mentira. Crie sua conta para conectar seus bancos de verdade.'
              : 'Por enquanto, cadastre suas contas à mão. Assim que a conexão estiver ativa, ela aparece aqui.'}
          </T>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModalHeader left={{ label: step === 'pronto' ? 'Concluir' : 'Cancelar', onPress: close }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 32, gap: 16 }}>
        {step === 'intro' ? (
          <>
            <T variant="title1">{reconnect ? 'Reconectar banco' : 'Conectar seu banco'}</T>
            <T variant="body" tone="ink2">
              Pelo Open Finance, o sistema oficial do Banco Central, o Baiu traz suas contas, cartões, investimentos e
              cada entrada e saída. Você não precisa digitar mais nada: só conferir.
            </T>

            <Plate style={styles.plate}>
              <Point icon="bank" title="Você escolhe o banco" text="Nubank, Itaú, Inter, Caixa, corretoras e outros." />
              <Point
                icon="lock"
                title="Autoriza no app do banco"
                text="A senha fica no banco. O Baiu nunca vê sua senha e não consegue mover dinheiro: o acesso é só para leitura."
              />
              <Point
                icon="sparkle"
                title="O Baiu organiza"
                text="Traz até 12 meses de histórico, separa salário, mercado, transporte e o resto, e atualiza sozinho."
              />
            </Plate>

            <T variant="title3">O que você autoriza</T>
            <View style={{ gap: 8 }}>
              {[
                'Dados lidos: contas, saldos, cartões e faturas, movimentos (com valor, data e descrição) e investimentos. A autorização vale pelo prazo que você escolher no banco, de até 12 meses.',
                'Quem participa: a Pluggy, empresa brasileira que faz a ponte com os bancos pelo Open Finance, a pedido do Baiu.',
                'Onde ficam: os dados passam pelo nosso servidor só para chegar ao seu celular, onde ficam criptografados. Não guardamos seus movimentos no servidor.',
                'Para que: organizar suas finanças, calcular o fôlego e os avisos do Baiu. Nada de propaganda ou venda de dados.',
                'Como cancelar: em Ajustes, Bancos conectados, ou no app do seu banco, quando quiser.',
              ].map((t) => (
                <View key={t} style={styles.bullet}>
                  <View style={styles.dot} />
                  <T variant="callout" style={{ flex: 1 }}>
                    {t}
                  </T>
                </View>
              ))}
            </View>

            {error ? (
              <T variant="callout" tone="vermilion">
                {error}
              </T>
            ) : null}
            <Button label="Concordo e quero conectar" onPress={start} loading={busy} />
            <Pressable onPress={() => router.push('/privacidade')} accessibilityRole="link" hitSlop={8}>
              <T variant="caption" tone="ink3" align="center">
                Detalhes na Política de privacidade
              </T>
            </Pressable>
          </>
        ) : null}

        {step === 'buscando' ? (
          <View style={styles.center}>
            <Baiu score={folego.score} width={150} />
            <T variant="title2" align="center">
              Buscando suas contas…
            </T>
            <T variant="callout" tone="ink2" align="center">
              Na primeira vez pode levar até um minuto: o Baiu traz até 12 meses de histórico e separa tudo por
              categoria.
            </T>
            <ActivityIndicator color={color.lantern} />
          </View>
        ) : null}

        {step === 'pronto' && result ? (
          <View style={styles.center}>
            <Baiu score={folego.score} width={150} />
            <T variant="title1" align="center">
              {reconnect ? 'Reconectado!' : 'Conectado!'}
            </T>
            <T variant="body" tone="ink2" align="center">
              {result.name} já está no Baiu e vai se atualizar sozinho.
            </T>
            {result.summary ? (
              <Plate style={[styles.plate, { alignSelf: 'stretch' }]}>
                <Line label="Contas e cartões" value={result.summary.accounts} />
                <Line label="Movimentos" value={result.summary.added} />
                <Line label="Investimentos" value={result.summary.investments} />
                {result.summary.paidBills ? (
                  <Line label="Vencimentos marcados como pagos" value={result.summary.paidBills} />
                ) : null}
              </Plate>
            ) : (
              <T variant="callout" tone="ink2" align="center">
                O banco ainda está preparando os dados. Eles aparecem em instantes.
              </T>
            )}
            {result.summary && result.summary.review > 0 ? (
              <>
                <T variant="callout" align="center">
                  {result.summary.review === 1
                    ? '1 movimento ficou para você conferir a categoria.'
                    : `${result.summary.review} movimentos ficaram para você conferir a categoria.`}
                </T>
                <Button
                  label="Conferir agora"
                  onPress={() => router.replace('/revisar')}
                  style={{ alignSelf: 'stretch' }}
                />
                <Button label="Depois" kind="quiet" onPress={close} />
              </>
            ) : (
              <Button
                label="Ver minhas contas"
                onPress={() => router.replace('/contas')}
                style={{ alignSelf: 'stretch' }}
              />
            )}
          </View>
        ) : null}

        {step === 'erro' ? (
          <View style={styles.center}>
            <Baiu score={10} width={130} still />
            <T variant="title2" align="center">
              Não deu para conectar
            </T>
            <T variant="callout" tone="ink2" align="center">
              {error}
            </T>
            <Button label="Tentar de novo" onPress={start} loading={busy} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Point({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.glyph}>
        <Icon name={icon} size={18} tint={color.lantern} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="calloutStrong">{title}</T>
        <T variant="callout" tone="ink2">
          {text}
        </T>
      </View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.line}>
      <T variant="callout" tone="ink2">
        {label}
      </T>
      <T variant="calloutStrong" tabular>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  center: { alignItems: 'center', gap: 14, paddingTop: 12, paddingHorizontal: gutter },
  plate: { padding: 14, gap: 14 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lanternWash,
  },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.lantern, marginTop: 7 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
});
