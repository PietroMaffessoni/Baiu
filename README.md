# Baiu

Gestão financeira pessoal com um mascote que reage ao seu dinheiro. O Baiu é um baiacu: quanto melhor você cuida das finanças, mais ele enche e mais forte é o brilho dele.

Versão 1.0. Para usar com dados reais é preciso criar uma conta; sem conta, só o modo de exemplo. Os registros financeiros ficam só no aparelho, criptografados e separados por conta. O servidor (Supabase) guarda apenas nome, e-mail, celular, senha protegida, os aceites, quais bancos estão conectados e um contador diário de perguntas à IA. Saldos e movimentos dos bancos passam pelo servidor só a caminho do aparelho. Não há anúncios nem analytics.

## O que o app faz

| Área | O que dá para fazer |
| --- | --- |
| Conta de usuário | Cadastro com confirmação do e-mail por código, login, recuperação de senha, edição de dados, troca de senha e exclusão da conta |
| Bancos conectados | Open Finance pela Pluggy: contas, cartões, investimentos e movimentos entram sozinhos, já categorizados; o Baiu junta transferências entre contas próprias, reconhece salário, marca vencimentos pagos e aprende com as correções |
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

1. **Conectar:** a pessoa autoriza no Baiu e no app do banco, pelo widget da Pluggy (`src/app/conectar.tsx`). A conexão é criada com o id da pessoa no provedor.
2. **Buscar:** a função `supabase/functions/bank` confere o login, confere no provedor que a conexão é da pessoa e devolve contas, movimentos e investimentos enxutos, sem CPF nem nomes. Nada fica guardado no servidor.
3. **Organizar no aparelho** (`src/lib/bank/merge.ts` e `categorize.ts`): saldos vêm do banco; cada movimento ganha uma categoria (regras aprendidas, depois a categoria do provedor, depois um dicionário de lojas); pagamento de fatura, Pix para si e aplicações viram transferências; salário é reconhecido pela repetição; vencimentos cadastrados são marcados como pagos.
4. **Atualizar:** ao abrir o app e ao voltar para ele (no máximo a cada 30 minutos), puxando a tela inicial para baixo, ou em Bancos conectados.
5. **Conferir:** o que o Baiu não teve certeza vai para "Confira". Corrigir uma categoria corrige os parecidos e vale para os próximos.

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

O servidor de contas é configurado uma vez, seguindo `supabase/LEIA-ME.md`. Para testar sem servidor, `EXPO_PUBLIC_AUTH_FAKE=1` liga um servidor falso em desenvolvimento e na web; o código de confirmação é sempre 246810, a IA responde com um texto de teste e a conexão de contas usa um banco de teste com histórico realista.

O Face ID, as notificações e o cofre no Keychain precisam de um build de desenvolvimento ou de teste. No Expo Go parte disso não funciona.

```bash
npx eas-cli build --platform android --profile preview   # APK para instalar direto
npx eas-cli build --platform ios --profile preview       # pede o login da Apple
```

## Comandos

```bash
npm test            # testes de lógica (saldos, fôlego, vencimentos, investimentos, cripto, CSV, contas)
npm run test:sql    # testa o SQL do servidor num Postgres embutido e as funções da IA e dos bancos, sem internet
npm run typecheck   # TypeScript
npm run lint        # ESLint
node scripts/build-legal-docs.mjs   # gera docs/privacidade.md e docs/termos.md a partir do app
```

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
  store/          estado do app e redutor
  theme/          cores, fontes e tipografia
docs/             privacidade, termos, suporte e exclusão de conta, publicados pelo GitHub
supabase/         SQL do servidor, funções da IA e dos bancos, modelos de e-mail e guia de configuração
store/            fichas da App Store e do Google Play e imagens das lojas
```

Documentos de produto e design: `PRODUCT.md` e `DESIGN.md`.

## Publicação

O passo a passo está em `store/app-store.md` e `store/google-play.md`.
