import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AuthScreen, Check, FormError } from '@/components/auth-form';
import { Button } from '@/components/button';
import { ListRow } from '@/components/form';
import { Plate, Rule } from '@/components/layout';
import legal from '@/content/legal.json';
import { authMessage } from '@/lib/auth';
import { accountsCsv, transactionsCsv } from '@/lib/csv';
import { shareCsv } from '@/lib/share';
import { useAuth } from '@/store/auth';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Os Termos ou a Política mudaram depois que a pessoa criou a conta. Ela lê o
 * resumo e aceita de novo antes de voltar ao app; o servidor registra o aceite
 * com a data. Quem não concorda ainda chega à assinatura e à conta, para
 * cancelar, exportar ou excluir.
 */
export default function NovosTermos() {
  const { acceptDocuments } = useAuth();
  const { state } = useStore();
  const hasData = state.txs.length > 0 || state.accounts.length > 0;
  const fail = (e: unknown) => Alert.alert('Não deu para exportar', String((e as Error)?.message ?? e));
  const [checked, setChecked] = useState(false);
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setTried(true);
    setError(null);
    if (!checked) {
      setError('Para continuar, marque que leu e aceita os textos novos.');
      return;
    }
    setLoading(true);
    try {
      await acceptDocuments();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      back={false}
      title="Os termos mudaram"
      subtitle={`Atualizamos os Termos de uso e a Política de privacidade em ${legal.updated}. Veja o que mudou.`}>
      <Plate style={{ padding: 16, gap: 10 }}>
        {legal.changes.map((c) => (
          <View key={c} style={{ flexDirection: 'row', gap: 8 }}>
            <T variant="callout" tone="lantern" importantForAccessibility="no" accessibilityElementsHidden>
              •
            </T>
            <T variant="callout" tone="ink2" style={{ flex: 1 }}>
              {c}
            </T>
          </View>
        ))}
      </Plate>

      <Plate style={{ paddingHorizontal: 14, marginTop: 14 }}>
        <ListRow icon="doc" label="Ler os Termos de uso" onPress={() => router.push('/termos')} chevron />
        <Rule inset={33} />
        <ListRow icon="privacy" label="Ler a Política de privacidade" onPress={() => router.push('/privacidade')} chevron />
      </Plate>

      <View style={{ marginTop: 18, marginBottom: 14 }}>
        <Check
          checked={checked}
          onChange={setChecked}
          error={tried}
          label="Li e aceito os Termos de uso e a Política de privacidade atualizados">
          <T variant="callout">Li e aceito os Termos de uso e a Política de privacidade atualizados.</T>
        </Check>
      </View>

      <FormError message={error} />
      <Button label="Continuar" onPress={accept} loading={loading} />

      <T variant="caption" tone="ink2" align="center" style={{ marginTop: 18 }}>
        Se não concordar, você pode cancelar a assinatura, exportar seus registros ou excluir a conta, sem multa.
      </T>
      <Plate style={{ paddingHorizontal: 14, marginTop: 12 }}>
        <ListRow icon="card" label="Assinatura" onPress={() => router.push('/assinatura')} chevron />
        <Rule inset={33} />
        {hasData ? (
          <>
            <ListRow
              icon="share"
              label="Exportar movimentos"
              hint="Planilha CSV com todos os registros."
              onPress={() => shareCsv(`baiu-movimentos-${today()}.csv`, transactionsCsv(state)).catch(fail)}
              chevron
            />
            <Rule inset={33} />
            <ListRow
              icon="share"
              label="Exportar contas"
              hint="Planilha CSV com saldos atuais."
              onPress={() => shareCsv(`baiu-contas-${today()}.csv`, accountsCsv(state)).catch(fail)}
              chevron
            />
            <Rule inset={33} />
          </>
        ) : null}
        <ListRow
          icon="settings"
          label="Minha conta"
          hint="Sair, ver seus dados ou excluir a conta."
          onPress={() => router.push('/minha-conta')}
          chevron
        />
      </Plate>
    </AuthScreen>
  );
}
