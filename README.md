# Baiu

Gestão financeira pessoal com um mascote que reage ao seu dinheiro. O Baiu é um baiacu: quanto melhor você cuida das finanças, mais ele enche e mais forte é o brilho dele.

Versão 1.0. Para usar com dados reais é preciso criar uma conta e assinar (o primeiro mês é grátis); sem conta, só o modo de exemplo. Os registros financeiros ficam só no aparelho, criptografados e separados por conta. O servidor (Supabase) guarda apenas nome, e-mail, celular, senha protegida, os aceites, quais bancos estão conectados e um contador diário de perguntas à IA. Saldos e movimentos dos bancos passam pelo servidor só a caminho do aparelho. Não há anúncios nem analytics.

## O que o app faz

| Área | O que dá para fazer |
| --- | --- |
| Conta de usuário | Cadastro com confirmação do e-mail por código, login, recuperação de senha, edição de dados, troca de senha e exclusão da conta |
| Bancos conectados | Open Finance pela Polp (dados recebidos pela Celcoin): contas, cartões, investimentos e movimentos entram sozinhos, já categorizados; o Baiu junta transferências entre contas próprias, reconhece salário, marca vencimentos pagos e aprende com as correções |
| Assinatura | Primeiro mês grátis e cobrança mensal pela App Store ou pelo Google Play, com o RevenueCat conferindo os recibos; cancelamento em dois toques, aviso antes da primeira cobrança e reembolso pela loja |
| Contas | Conta corrente, reserva, cartão de crédito e corretora, conectadas ou com saldo informado pelo usuário |
| Movimentos | Entradas, saídas e transferências, com categoria, forma de pagamento e data; editar e apagar |
| Cartão | Fatura como dívida; transferir para o cartão paga a fatura |
| Vencimentos | Boletos e contas fixas, recorrência mensal, pagamento que vira saída no extrato |
| Investimentos | Aplicações, aportes de outra conta, atualização de valor, resgates e constância mensal |
| Fôlego | Nota de 0 a 100 em quatro pilares, com o próximo passo em reais |
| Selos | Carimbos por hábitos saudáveis |
| Assistente | Conversa com o Baiu: avisos de gastos fora do normal, contas que se repetem, respostas prontas no aparelho e, com consentimento, respostas de IA (Anthropic) com um resumo sem dados pessoais |
| Personalização | Oito cores para o Baiu e enfeites automáticos em oito datas comemorativas, que dá para desligar |
| Segurança | Dados cifrados, bloqueio por Face ID ou biometria, ocultar valores, cortina no seletor de apps |
| Lembretes | Notificação local um dia antes e no dia do vencimento, e aviso quando um gasto foge do normal, sem valores no texto |
| Seus dados | Exportação em CSV e exclusão total |

Na primeira tela, "Explorar com dados de exemplo" carrega um mês fictício, sem conta. Para sair dele: Ajustes, "Sair do modo exemplo".

## Como o fôlego funciona

O fôlego vai de 0 a 100 e soma quatro pilares de 25 pontos, calculados sobre os últimos 30 dias:

1. **Gastou menos do que entrou:** cheio com gastos abaixo de 60% das entradas.
2. **Reserva de emergência:** cheio com seis meses de gastos guardados.
3. **Contas em dia:** cada vencimento atrasado tira metade do pilar.
4. **Investiu este mês:** cheio investindo 15% do que entrou.

| Fôlego | Estado do Baiu |
| --- | --- |
| 0 a 24 | Murcho |
| 25 a 49 | Meio cheio |
| 50 a 74 | Cheio |
| 75 a 100 | Estufado |

A regra está em `src/lib/folego.ts`.

## Como a conexão com bancos funciona

1. **Conectar:** na jornada exigida pelo Banco Central (`src/app/conectar.tsx`), a pessoa aceita os termos da Celcoin, escolhe o banco, confere as categorias de dados, a finalidade e o prazo, informa o CPF e autoriza no app do banco. A autorização é criada na Polp com o id da pessoa. Os textos obrigatórios estão em `src/lib/bank/consent-text.ts`.
2. **Buscar:** a função `supabase/functions/bank` confere o login, confere na Polp que a autorização é da pessoa e devolve contas, movimentos e investimentos enxutos, sem CPF nem nomes. Nada fica guardado no servidor.
3. **Organizar no aparelho** (`src/lib/bank/merge.ts` e `categorize.ts`): saldos vêm do banco; cada movimento ganha uma categoria (regras aprendidas, depois a categoria do provedor, depois um dicionário de lojas); pagamento de fatura, Pix para si e aplicações viram transferências; salário é reconhecido pela repetição; vencimentos cadastrados são marcados como pagos.
4. **Atualizar:** a Polp sincroniza com os bancos sozinha (saldos a cada 2 horas, movimentos a cada 3, pelo limite do Open Finance). O app busca ao abrir e ao voltar para ele (no máximo a cada hora), puxando a tela inicial para baixo, ou em Bancos conectados.
5. **Conferir:** o que o Baiu não teve certeza vai para "Confira". Corrigir uma categoria corrige os parecidos e vale para os próximos.
6. **Cancelar:** Bancos conectados é o "Portal" do Open Finance: mostra todas as autorizações, inclusive as canceladas (`src/app/autorizacao/[id].tsx`), e cancela a qualquer momento.

## Como a assinatura funciona

1. **Assinar:** depois do cadastro, a tela `src/app/assinatura.tsx` mostra o que está incluso, o preço e as condições. A compra acontece na loja do celular; o Baiu nunca vê dados de pagamento.
2. **Conferir:** o RevenueCat (`src/lib/subscription/revenuecat.ts`) confere os recibos e conhece a pessoa só pelo id da conta. Sem assinatura ativa, o app só abre a tela de assinatura, Minha conta e os textos legais, e deixa exportar os registros.
3. **No servidor:** as funções `bank` e `baiu-chat` perguntam ao RevenueCat se a pessoa assina antes de gastar com a Polp ou com a IA. Desconectar bancos e excluir a conta funcionam sempre.
4. **Cancelar:** em Ajustes, Assinatura, o app explica e abre a página da loja. Dois dias antes do fim do mês grátis, uma notificação avisa.
5. **Excluir a conta:** a função `supabase/functions/subscription` apaga o cadastro no RevenueCat.

Sem as chaves do RevenueCat no build, a cobrança fica desligada e o app, liberado.

## Como o assistente funciona

Os avisos e as contas que se repetem são calculados no aparelho (`src/lib/assistant/insights.ts`): o Baiu agrupa gastos parecidos ("Açaí do Zé" e "Açaí Concept" viram açaí; Enel e Cemig viram conta de luz) e compara com o mês passado. Um aviso por vez vira notificação, entre 10h e 20h, sem valores.

A conversa responde de três jeitos:

1. **Modo exemplo, IA desligada ou sem internet:** respostas prontas com os números da pessoa (`src/lib/assistant/local.ts`).
2. **Conta com IA ligada:** a função `supabase/functions/baiu-chat` confere login, consentimento e limite diário e pergunta à IA. Vão só a pergunta, a conversa recente e o resumo de `src/lib/assistant/context.ts`.
3. **Se a IA falhar:** volta para a resposta pronta, avisando o motivo.

## Rodar no computador

Pré-requisito: Node 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a chave pública do Supabase
npx expo start
```

O servidor de contas é configurado uma vez, seguindo `supabase/LEIA-ME.md`. Para testar sem servidor, `EXPO_PUBLIC_AUTH_FAKE=1` liga um servidor falso em desenvolvimento e na web; o código de confirmação é sempre 246810, a IA responde com um texto de teste e a conexão de contas usa um banco de teste com histórico realista e a assinatura usa uma loja de teste.

O Face ID, as notificações e o cofre no Keychain precisam de um build de desenvolvimento ou de teste. No Expo Go parte disso não funciona.

```bash
npx eas-cli build --platform android --profile preview   # APK para instalar direto
npx eas-cli build --platform ios --profile preview       # pede o login da Apple
```

## Comandos

```bash
npm test            # testes de lógica (saldos, fôlego, vencimentos, investimentos, cripto, CSV, contas)
npm run test:sql    # testa o SQL do servidor num Postgres embutido e as funções da IA, dos bancos e da assinatura, sem internet
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run test:e2e    # roteiros de navegador: uso diário, cadastro, bancos, assistente, assinatura, personalização e telas pequenas
npm run store:images   # refaz as capturas das lojas e a captura da assinatura para a revisão da Apple
node scripts/build-legal-docs.mjs   # gera docs/privacidade.md e docs/termos.md a partir do app
```

Os roteiros de navegador geram a versão web com o servidor, o banco, a IA e a loja falsos (`EXPO_PUBLIC_AUTH_FAKE=1`) e usam o Edge ou o Chrome instalados (outro navegador: `BAIU_BROWSER`). `npm run test:e2e -- bancos assinatura` roda só alguns; `--sem-build` reaproveita a última versão web. As falhas ficam com uma captura em `e2e/capturas/`.

## Estrutura

```
src/
  app/            rotas (Expo Router)
  components/     peças de interface; o mascote fica em components/baiu/
  content/        política de privacidade e termos mostrados no app
  data/           tipos, bancos, categorias e dados de exemplo
  lib/            fôlego, saldos, vencimentos, selos, cofre cifrado, lembretes, CSV
  lib/auth/       validação do cadastro, cliente do Supabase e servidor falso para testes
  lib/assistant/  avisos, respostas prontas, resumo enviado à IA e IA falsa para testes
  lib/bank/       categorias automáticas, junção dos dados do banco e banco de teste
  lib/subscription/ assinatura: lojas pelo RevenueCat, estado, avisos e loja de teste
  store/          estado do app e redutor
  theme/          cores, fontes e tipografia
docs/             privacidade, termos, suporte e exclusão de conta, publicados pelo GitHub
e2e/              roteiros de navegador (e2e/roteiros) e o gerador das imagens das lojas
supabase/         SQL do servidor, funções da IA, dos bancos e da assinatura, modelos de e-mail e guia de configuração
store/            fichas da App Store e do Google Play e imagens das lojas
```

Documentos de produto e design: `PRODUCT.md` e `DESIGN.md`.

## Publicação

O passo a passo está em `store/app-store.md` e `store/google-play.md`.
