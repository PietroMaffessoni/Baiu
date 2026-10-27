import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { BankMark } from '@/components/bank-mark';
import { Button } from '@/components/button';
import { FieldLabel, ModalHeader, TextField } from '@/components/form';
import { Icon, type IconName } from '@/components/icon';
import { Plate } from '@/components/layout';
import { normalize } from '@/lib/assistant/insights';
import { BANK_MESSAGES, BankFailure, bankBackend, MAX_BANKS } from '@/lib/bank/client';
import {
  CATEGORIES,
  CELCOIN_LINKS,
  DISCLAIMER_1,
  disclaimer2,
  disclaimer3,
  IOS_HIDDEN_APP,
  PRODUCTS,
  PURPOSES,
  REDIRECT_NOTICE,
  redirectSteps,
  TERM,
} from '@/lib/bank/consent-text';
import { formatCpf, validCpf } from '@/lib/bank/cpf';
import { bankIdFor, type SyncSummary } from '@/lib/bank/merge';
import type { ConnectStart, Institution } from '@/lib/bank/types';
import { useBank } from '@/lib/bank/use-bank';
import { close } from '@/lib/nav';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

type Step = 'intro' | 'banco' | 'confirmar' | 'aguardando' | 'buscando' | 'pronto' | 'erro';

/** Nome do botão que leva ao banco: o Disclaimer #2 cita exatamente este texto. */
const GO = 'Ir para o banco';

const message = (e: unknown) => BANK_MESSAGES[e instanceof BankFailure ? e.code : 'unknown'];

/**
 * Conectar um banco pelo Open Finance, na jornada que o Banco Central exige:
 * 1. o Baiu explica e a pessoa aceita os termos da Celcoin;
 * 2. escolhe o banco;
 * 3. confere os dados, a finalidade e o prazo, e informa o CPF;
 * 4. vai ao app do banco autorizar e volta;
 * 5. o Baiu traz e organiza tudo.
 * Reconectar pula direto para o passo 4: as categorias são as mesmas.
 */
export default function Conectar() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const reconnect = typeof itemId === 'string' && itemId.length > 0;
  const { state } = useStore();
  const folego = useFolego();
  const insets = useSafeAreaInsets();
  const { syncNow } = useBank();
  const [step, setStep] = useState<Step>('intro');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banks, setBanks] = useState<Institution[] | null>(null);
  const [query, setQuery] = useState('');
  const [bank, setBank] = useState<Institution | null>(null);
  const [cpf, setCpf] = useState('');
  const [consent, setConsent] = useState<ConnectStart | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ name: string; summary: SyncSummary | null } | null>(null);
  const checking = useRef(false);

  const loadBanks = useCallback(async () => {
    setError(null);
    try {
      setBanks(await bankBackend.institutions());
    } catch (e) {
      setError(message(e));
    }
  }, []);

  const finish = useCallback(
    async (c: ConnectStart) => {
      setStep('buscando');
      const summary = await syncNow();
      setResult({ name: c.name, summary });
      setStep('pronto');
    },
    [syncNow],
  );

  /** Abre o banco ou, se a autorização já está pronta (ambiente de teste), segue direto. */
  const proceed = async (c: ConnectStart) => {
    setConsent(c);
    if (c.status === 'AUTHORISED' || !c.url) return finish(c);
    setPending(false);
    setStep('aguardando');
    try {
      await Linking.openURL(c.url);
    } catch {
      setError('Não deu para abrir o banco. Toque em "Abrir o banco de novo".');
    }
  };

  const start = async () => {
    if (!bank) return;
    if (!validCpf(cpf)) {
      setError(BANK_MESSAGES.cpf);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await proceed(await bankBackend.start(bank.id, cpf));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    setBusy(true);
    setError(null);
    try {
      await proceed(await bankBackend.reconnect(itemId as string));
    } catch (e) {
      setError(message(e));
      setStep('erro');
    } finally {
      setBusy(false);
    }
  };

  /** A pessoa voltou do banco? Pergunta à Polp como está a autorização. */
  const check = useCallback(
    async (asked: boolean) => {
      if (!consent || checking.current) return;
      checking.current = true;
      if (asked) setBusy(true);
      try {
        const s = await bankBackend.status(consent.id);
        if (s.consent === 'AUTHORISED') await finish(consent);
        else if (s.consent === 'REJECTED' || s.consent === 'EXPIRED') {
          setError('O banco não concluiu a autorização. Você pode tentar de novo.');
          setStep('erro');
        } else if (asked) setPending(true);
      } catch (e) {
        if (asked) setError(message(e));
      } finally {
        checking.current = false;
        setBusy(false);
      }
    },
    [consent, finish],
  );

  // ao voltar do app do banco, confere sozinho
  useEffect(() => {
    if (step !== 'aguardando') return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check(false));
    const link = Linking.addEventListener('url', ({ url }) => /open-finance/.test(url) && check(false));
    return () => {
      sub.remove();
      link.remove();
    };
  }, [step, check]);

  const shown = useMemo(() => {
    const q = normalize(query);
    const list = banks ?? [];
    return q ? list.filter((b) => normalize(b.name).includes(q)) : list;
  }, [banks, query]);

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

  const back =
    step === 'banco'
      ? () => setStep('intro')
      : step === 'confirmar'
        ? () => {
            setError(null);
            setStep('banco');
          }
        : null;

  return (
    <View style={styles.screen}>
      <ModalHeader
        left={
          back
            ? { label: 'Voltar', onPress: back }
            : { label: step === 'pronto' ? 'Concluir' : 'Cancelar', onPress: close }
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 32, gap: 16 }}>
        {step === 'intro' && reconnect ? (
          <>
            <T variant="title1">Reconectar banco</T>
            <T variant="body" tone="ink2">
              O Baiu vai pedir ao banco uma nova autorização, com os mesmos dados de antes. Você confirma no app do
              banco e volta para cá.
            </T>
            <T variant="callout" tone="ink2">
              {REDIRECT_NOTICE}
            </T>
            {Platform.OS === 'ios' ? (
              <T variant="caption" tone="ink3">
                {IOS_HIDDEN_APP}
              </T>
            ) : null}
            {error ? (
              <T variant="callout" tone="vermilion">
                {error}
              </T>
            ) : null}
            <Button label={GO} onPress={restart} loading={busy} />
          </>
        ) : null}

        {step === 'intro' && !reconnect && state.bank.items.length >= MAX_BANKS ? (
          <View style={styles.center}>
            <Baiu score={folego.score} width={130} still />
            <T variant="title2" align="center">
              {`Você já tem ${MAX_BANKS} bancos conectados`}
            </T>
            <T variant="callout" tone="ink2" align="center">
              {`A assinatura inclui até ${MAX_BANKS} bancos. Para conectar outro, desconecte um dos que estão no Baiu. O que já veio dele continua aqui, se você quiser.`}
            </T>
            <Button
              label="Ver bancos conectados"
              onPress={() => router.replace('/bancos')}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : null}

        {step === 'intro' && !reconnect && state.bank.items.length < MAX_BANKS ? (
          <>
            <T variant="title1">Conectar seu banco</T>
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
                text="Traz o histórico que o banco enviar, separa salário, mercado, transporte e o resto, e atualiza sozinho."
              />
            </Plate>

            <T variant="title3">Quem participa</T>
            <View style={{ gap: 8 }}>
              {[
                'A Celcoin, instituição de pagamento autorizada pelo Banco Central, recebe os dados do seu banco pelo Open Finance. A Polp, empresa brasileira de tecnologia, faz a ponte a pedido do Baiu.',
                'Os dados passam pelo nosso servidor só para chegar ao seu celular, onde ficam criptografados. O Baiu não guarda seus movimentos no servidor.',
                'Você cancela quando quiser, em Bancos conectados, ou no app do seu banco.',
              ].map((t) => (
                <Bullet key={t} text={t} />
              ))}
            </View>

            <T variant="callout" style={styles.legal}>
              {DISCLAIMER_1.map((part) =>
                part.link ? (
                  <T
                    key={part.text}
                    variant="callout"
                    tone="lantern"
                    accessibilityRole="link"
                    onPress={() => Linking.openURL(CELCOIN_LINKS[part.link!])}
                    style={styles.link}>
                    {part.text}
                  </T>
                ) : (
                  part.text
                ),
              )}
            </T>

            <Button
              label="Continuar"
              onPress={() => {
                setStep('banco');
                if (!banks) loadBanks();
              }}
            />
            <Pressable onPress={() => router.push('/privacidade')} accessibilityRole="link" hitSlop={8}>
              <T variant="caption" tone="ink3" align="center">
                Política de privacidade do Baiu
              </T>
            </Pressable>
          </>
        ) : null}

        {step === 'banco' ? (
          <>
            <T variant="title1">Escolha o banco</T>
            <T variant="body" tone="ink2">
              Selecione a conta de onde quer compartilhar seus dados
            </T>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar banco"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Buscar banco"
            />
            {error ? (
              <>
                <T variant="callout" tone="vermilion">
                  {error}
                </T>
                <Button label="Tentar de novo" kind="secondary" onPress={loadBanks} />
              </>
            ) : null}
            {!banks && !error ? <ActivityIndicator color={color.lantern} /> : null}
            {banks && shown.length === 0 ? (
              <T variant="callout" tone="ink2">
                Nenhum banco com esse nome no Open Finance.
              </T>
            ) : null}
            <View style={{ gap: 2 }}>
              {shown.map((b) => {
                const down = b.status === 'MAJOR_OUTAGE';
                return (
                  <Pressable
                    key={b.id}
                    disabled={down}
                    onPress={() => {
                      setBank(b);
                      setError(null);
                      setStep('confirmar');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={b.name}
                    accessibilityState={{ disabled: down }}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.plateHi }, down && { opacity: 0.45 }]}>
                    <BankMark bankId={bankIdFor(b.name)} size={34} />
                    <View style={{ flex: 1 }}>
                      <T variant="body">{b.name}</T>
                      {b.status !== 'OPERATIONAL' ? (
                        <T variant="caption" tone={down ? 'vermilion' : 'lantern'}>
                          {down ? 'Fora do ar agora' : 'Instabilidade'}
                        </T>
                      ) : null}
                    </View>
                    <Icon name="chevron" size={13} tint={color.ink3} />
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 'confirmar' && bank ? (
          <>
            <T variant="title1">Confira e autorize</T>
            <View style={styles.chosen}>
              <BankMark bankId={bankIdFor(bank.name)} size={40} />
              <T variant="bodyStrong" style={{ flex: 1 }}>
                {bank.name}
              </T>
            </View>

            <View style={{ gap: 6 }}>
              <FieldLabel>CPF do titular da conta</FieldLabel>
              <TextField
                value={formatCpf(cpf)}
                onChangeText={(v) => {
                  setCpf(v);
                  if (error) setError(null);
                }}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
                autoComplete="off"
                accessibilityLabel="CPF do titular da conta"
              />
              <T variant="caption" tone="ink3">
                O banco confere se o CPF é o seu. Ele vai para a Celcoin e não fica guardado no Baiu. Para contato, vale
                o e-mail da sua conta no Baiu.
              </T>
            </View>

            <T variant="title3">Dados que serão compartilhados</T>
            <View style={{ gap: 8 }}>
              {PRODUCTS.map((p) => (
                <More key={p} title={CATEGORIES[p].label} text={CATEGORIES[p].details} />
              ))}
            </View>
            <T variant="caption" tone="ink2">
              {disclaimer3(PRODUCTS)}
            </T>

            <More title="Finalidade do Compartilhamento" list={PURPOSES} />

            <View style={{ gap: 4 }}>
              <T variant="title3">Prazo do compartilhamento</T>
              <View style={styles.term}>
                <Icon name="check" size={16} tint={color.lantern} />
                <T variant="callout">{TERM}</T>
              </View>
            </View>

            <Plate style={styles.plate}>
              <View style={styles.term}>
                <Icon name="lock" size={16} tint={color.lantern} />
                <T variant="calloutStrong" style={{ flex: 1 }}>
                  {REDIRECT_NOTICE}
                </T>
              </View>
              {redirectSteps(bank.name).map((s, i) => (
                <T key={s} variant="callout" tone="ink2">
                  {`${i + 1}. ${s}`}
                </T>
              ))}
              {Platform.OS === 'ios' ? (
                <T variant="caption" tone="ink3">
                  {IOS_HIDDEN_APP}
                </T>
              ) : null}
            </Plate>

            <T variant="callout" style={styles.legal}>
              {disclaimer2(GO)}
            </T>
            <T variant="caption" tone="ink3">
              O Portal é a área Bancos conectados do Baiu, onde você vê e cancela suas autorizações.
            </T>

            {error ? (
              <T variant="callout" tone="vermilion">
                {error}
              </T>
            ) : null}
            <Button label={GO} onPress={start} loading={busy} disabled={!validCpf(cpf)} />
          </>
        ) : null}

        {step === 'aguardando' && consent ? (
          <View style={styles.center}>
            <Baiu score={folego.score} width={130} />
            <T variant="title2" align="center">
              Autorize no app do banco
            </T>
            <T variant="callout" tone="ink2" align="center">
              {`Confirme o compartilhamento em ${consent.name} e volte para o Baiu. A gente confere sozinho quando você voltar.`}
            </T>
            {pending ? (
              <T variant="callout" tone="lantern" align="center">
                Ainda não recebemos a autorização do banco. Termine lá e volte aqui.
              </T>
            ) : null}
            {error ? (
              <T variant="callout" tone="vermilion" align="center">
                {error}
              </T>
            ) : null}
            <Button label="Já autorizei" onPress={() => check(true)} loading={busy} style={{ alignSelf: 'stretch' }} />
            <Button
              label="Abrir o banco de novo"
              kind="secondary"
              onPress={() => consent.url && Linking.openURL(consent.url).catch(() => {})}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : null}

        {step === 'buscando' ? (
          <View style={styles.center}>
            <Baiu score={folego.score} width={150} />
            <T variant="title2" align="center">
              Buscando suas contas…
            </T>
            <T variant="callout" tone="ink2" align="center">
              Na primeira vez pode levar até um minuto: o Baiu traz o histórico e separa tudo por categoria.
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
            {result.summary && (result.summary.accounts > 0 || result.summary.added > 0 || reconnect) ? (
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
                O banco ainda está enviando os dados. Eles aparecem sozinhos em alguns minutos.
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
            <Button
              label="Tentar de novo"
              onPress={() => {
                setError(null);
                setStep(reconnect ? 'intro' : 'confirmar');
              }}
              style={{ alignSelf: 'stretch' }}
            />
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

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.dot} />
      <T variant="callout" style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

/** Título sempre à vista; o detalhe abre com um toque (o manual permite esconder só o detalhe). */
function More({ title, text, list }: { title: string; text?: string; list?: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Plate style={styles.more}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Esconde os detalhes' : 'Mostra os detalhes'}
        style={styles.moreHead}>
        <T variant="calloutStrong" style={{ flex: 1 }}>
          {title}
        </T>
        <T variant="caption" tone="lantern">
          {open ? 'Esconder' : 'Ver detalhes'}
        </T>
      </Pressable>
      {open && text ? (
        <T variant="caption" tone="ink2">
          {text}
        </T>
      ) : null}
      {open && list ? (
        <View style={{ gap: 6 }}>
          {list.map((t) => (
            <Bullet key={t} text={t} />
          ))}
        </View>
      ) : null}
    </Plate>
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
  center: { alignItems: 'center', gap: 14, paddingTop: 12 },
  plate: { padding: 14, gap: 12 },
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
  legal: { lineHeight: 22 },
  link: { textDecorationLine: 'underline' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.tile,
  },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  term: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  more: { padding: 14, gap: 10 },
  moreHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
