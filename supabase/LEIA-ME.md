# Supabase do Baiu: o que falta fazer e conferir

Este guia é para quem cuida do banco de dados e do servidor do Baiu. Ele lista tudo o que precisa estar pronto no Supabase antes de o app ir para as lojas, e diz como conferir cada item.

Marque cada caixa só depois de conferir no painel ou com a consulta indicada. Siga a ordem: as partes do fim dependem das do começo.

## O que o Supabase faz no Baiu

O Supabase cuida de quatro coisas:

- **Contas.** Cadastro, login, códigos por e-mail, troca de senha e exclusão da conta.
- **Conversa com IA.** A função `baiu-chat` leva a pergunta à Anthropic e conta as perguntas de cada pessoa no dia.
- **Bancos conectados.** A função `bank` faz a ponte com a Polp, que recebe os dados pelo Open Finance por meio da Celcoin.
- **Assinatura.** As funções conferem no RevenueCat quem assina. A função `subscription` apaga a pessoa do RevenueCat quando ela exclui a conta.

O servidor guarda pouco:

- nome, e-mail, celular e senha protegida;
- os aceites (termos, privacidade, maioridade, IA e cada banco conectado);
- quais bancos cada pessoa conectou;
- um contador diário de perguntas à IA.

Os registros financeiros ficam só no celular da pessoa. Saldos e movimentos dos bancos passam pela função `bank` a caminho do aparelho e não são gravados no servidor.

## Arquivos desta pasta

| Arquivo | O que é |
| --- | --- |
| `migrations/20261014120000_contas.sql` | Tabela `consents`, validação do cadastro e exclusão da conta |
| `migrations/20261015120000_assistente.sql` | Aceite da IA e tabela `assistant_usage` (limite diário) |
| `migrations/20261015130000_bancos.sql` | Tabela `bank_connections` e aceite de cada banco |
| `migrations/20261023120000_polp.sql` | Histórico das autorizações dos bancos (desconectar marca a data em vez de apagar) e categorias autorizadas |
| `functions/baiu-chat/index.ts` | Função da conversa com IA |
| `functions/bank/index.ts` | Função dos bancos conectados |
| `functions/subscription/index.ts` | Função que apaga a pessoa do RevenueCat |
| `templates/*.html` | Modelos dos e-mails de código e de senha alterada |

## Quem faz o quê

| Parte | Responsável |
| --- | --- |
| Tudo dentro do painel do Supabase (passos 1 a 9 e 11 a 13) | Sócio |
| Contrato e chaves da Polp (Open Finance) | Pietro |
| Chaves da Anthropic e do RevenueCat | Quem criar essas contas; os valores vão direto para o painel (passo 7) |
| Variáveis do app no EAS (passo 8) | Quem tiver acesso à conta `pitroibas` no Expo |

**Regra das chaves secretas.** Uma chave secreta só pode ficar em dois lugares: no painel do serviço que a gerou e em **Edge Functions, Secrets** no Supabase. Nunca mande essas chaves por WhatsApp, e-mail ou GitHub, nem coloque no app. Se precisar repassar uma, use um gerenciador de senhas. O mais simples é a pessoa que tem a chave colá-la ela mesma no Supabase.

## O que já foi feito (a confirmar)

Em 15/10/2026 o Pietro deixou isto pronto. Ninguém conferiu ainda se funcionou:

- projeto criado na região São Paulo;
- Data API ligada;
- exposição automática de tabelas desligada;
- RLS automático ligado;
- integração com o GitHub conectada.

O passo 2 confere se as quatro migrações rodaram. Os passos 4 a 6 (modelos de e-mail, SMTP e ligação com o app) ficaram para depois e ainda estão pendentes.

---

## 1. Acesso e plano

- [ ] O sócio é membro da organização no Supabase com papel **Owner** ou **Administrator** (**Organization settings, Team**).
- [ ] O projeto se chama `baiu` e a região é **South America (São Paulo)** (**Project Settings, General**). A política de privacidade promete que os dados ficam no Brasil.
- [ ] A senha do banco está guardada num gerenciador de senhas.
- [ ] **Plano pago (Pro) antes de publicar.** No plano grátis, o projeto pausa depois de uma semana sem uso e não tem backup diário. Um projeto pausado deixa o app sem login.

## 2. Banco de dados (migrações)

A integração com o GitHub aplica sozinha, a cada envio para a `main`, os arquivos novos de `supabase/migrations/`.

- [ ] Em **Project Settings, Integrations, GitHub**, confira os campos:

  | Campo | Valor |
  | --- | --- |
  | Working directory | `.` |
  | Production branch | `main` |
  | Deploy to production | Ligado |

- [ ] As quatro migrações rodaram. Confira no **SQL Editor**:

  ```sql
  select version, name from supabase_migrations.schema_migrations order by version;
  ```

  O resultado deve ter `20261014120000`, `20261015120000`, `20261015130000` e `20261023120000`.

  Se faltar alguma, ou se a tabela `supabase_migrations.schema_migrations` não existir, veja os erros em **Integrations, GitHub**. Também dá para colar cada arquivo no SQL Editor, um de cada vez e na ordem da data, e rodar. Os três arquivos podem rodar de novo sem estragar nada.

- [ ] As tabelas existem e estão com RLS ligado:

  ```sql
  select relname as tabela, relrowsecurity as rls
  from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'
  order by 1;
  ```

  Resultado esperado: `assistant_usage`, `bank_connections` e `consents`, todas com `rls = true`.

- [ ] As permissões estão fechadas:

  ```sql
  select t as tabela, r as papel,
         has_table_privilege(r, 'public.' || t, 'select') as le,
         has_table_privilege(r, 'public.' || t, 'insert')
           or has_table_privilege(r, 'public.' || t, 'update')
           or has_table_privilege(r, 'public.' || t, 'delete') as grava
  from unnest(array['consents', 'assistant_usage', 'bank_connections']) t,
       unnest(array['anon', 'authenticated']) r
  order by 1, 2;
  ```

  Resultado esperado:

  - `grava` é `false` em todas as linhas;
  - `le` é `true` só para `authenticated` em `consents` e em `bank_connections`;
  - o resto é `false`.

  Ninguém grava nas tabelas pela API. As gravações passam só pelas funções do banco.

- [ ] As funções do banco existem e só quem está logado pode chamá-las:

  ```sql
  select f,
         has_function_privilege('anon', f, 'execute') as anon,
         has_function_privilege('authenticated', f, 'execute') as logado
  from unnest(array[
    'public.delete_account()',
    'public.assistant_consent(boolean, text)',
    'public.assistant_take(text, integer)',
    'public.bank_link(text, text, text)',
    'public.bank_unlink(text)'
  ]) f;
  ```

  Resultado esperado: `anon = false` e `logado = true` nas cinco.

- [ ] Os dois gatilhos estão na tabela de usuários:

  ```sql
  select tgname from pg_trigger
  where tgrelid = 'auth.users'::regclass and not tgisinternal;
  ```

  O resultado deve ter `baiu_check_user` e `baiu_record_consents`.

- [ ] A validação funciona. Em **Authentication, Users**, tente criar um usuário pelo botão **Add user**. **Tem que dar erro**, porque faltam nome, celular e aceites. Daqui em diante, contas só nascem pelo app.

## 3. Autenticação

Em **Authentication**:

- [ ] **Sign In / Providers, Email**: ligado, com **Confirm email** e **Secure email change** ligados.
- [ ] **Sign In / Providers, Email**: **Email OTP Length** = `6` e **Email OTP Expiration** = `3600`.
- [ ] Senha mínima de 8 caracteres, exigindo minúsculas, maiúsculas, números e símbolos. O app já pede isso, e o servidor tem que pedir igual.
- [ ] **Sign In / Providers**: telefone, login anônimo e redes sociais desligados.
- [ ] **Allow new users to sign up** ligado.
- [ ] **Rate Limits**: pode ficar no padrão.
- [ ] Opcional, no plano Pro: ligar **Leaked password protection**, que recusa senhas que já vazaram na internet.

O app usa códigos de 6 dígitos, não links. Por isso não é preciso mexer em **URL Configuration** nem em links de retorno.

## 4. Modelos de e-mail

Em **Authentication, Emails, Templates**, troque o assunto e o corpo de cada modelo pelo arquivo de `supabase/templates/`. O assunto está na primeira linha de cada arquivo, dentro do comentário `<!-- Assunto: ... -->`. Cole o arquivo inteiro no corpo.

- [ ] **Confirm signup** ← `confirmar-cadastro.html`
- [ ] **Reset Password** ← `recuperar-senha.html`
- [ ] **Password changed** (em **Security notifications**; ligue a notificação) ← `senha-alterada.html`

Os modelos de código usam `{{ .Token }}`. Se o e-mail chegar com um link em vez do código de 6 dígitos, o modelo não foi trocado.

## 5. Envio de e-mails (SMTP)

O envio padrão do Supabase serve só para testes: manda poucos e-mails por hora, e só para membros da equipe do projeto. Clientes reais não recebem o código e não conseguem se cadastrar.

- [ ] Configure um SMTP próprio em **Authentication, Emails, SMTP Settings**. Há duas opções:
  - **Rápida:** o Gmail do suporte, `suporte.baiu@gmail.com`. Ligue a verificação em duas etapas, crie uma "senha de app" e use `smtp.gmail.com`, porta 465. O limite é de uns 500 e-mails por dia.
  - **Recomendada:** um domínio próprio (por exemplo, baiu.app) com um provedor de e-mail transacional, como Resend ou Brevo. Os e-mails chegam melhor e não caem no spam.
- [ ] Depois de trocar o SMTP, aumente em **Rate Limits** o limite de e-mails por hora.
- [ ] Crie uma conta de teste com um e-mail de fora da equipe e confira se o código chega, e se chega fora do spam.

## 6. Funções (Edge Functions)

São três funções, cada uma num arquivo só, sem dependências:

| Nome da função | Arquivo |
| --- | --- |
| `baiu-chat` | `supabase/functions/baiu-chat/index.ts` |
| `bank` | `supabase/functions/bank/index.ts` |
| `subscription` | `supabase/functions/subscription/index.ts` |

- [ ] As três aparecem em **Edge Functions**, com o nome exato da tabela acima.

  Se alguma faltar, publique de um destes jeitos:

  - **Pelo painel:** **Edge Functions, Deploy a new function, Via Editor**. Use o nome da tabela, cole o conteúdo do arquivo e clique em **Deploy function**.
  - **Pelo terminal**, na pasta do projeto:

    ```bash
    npx supabase login
    npx supabase functions deploy baiu-chat --no-verify-jwt --project-ref ID-DO-PROJETO
    npx supabase functions deploy bank --no-verify-jwt --project-ref ID-DO-PROJETO
    npx supabase functions deploy subscription --no-verify-jwt --project-ref ID-DO-PROJETO
    ```

- [ ] Em cada função, **Enforce JWT verification** (ou **Verify JWT**) está **desligado**. As funções conferem o login sozinhas, pelo banco. A verificação automática não funciona com as chaves novas do Supabase e recusa todo mundo.
- [ ] A versão publicada é a da `main`. Sempre que um desses arquivos mudar no GitHub, publique a função de novo.

## 7. Segredos das funções

Em **Edge Functions, Secrets**:

| Nome | Obrigatório? | O que é | De onde vem |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Para a IA | Chave da API da Anthropic | console.anthropic.com, **API Keys** (apêndice A) |
| `BAIU_AI_MODEL` | Não | Modelo da IA. Padrão `claude-opus-5-5`; para gastar menos, `claude-sonnet-5-5` ou `claude-haiku-5-5` | Decisão do Pietro e do sócio |
| `BAIU_AI_DAILY_LIMIT` | Não | Perguntas por pessoa por dia. Padrão 30 | Decisão do Pietro e do sócio |
| `POLP_CLIENT_ID` | Para os bancos | `x-api-client` da Polp (um UUID) | Pietro (apêndice C) |
| `POLP_CLIENT_SECRET` | Para os bancos | `x-api-secret` da Polp. Aparece uma vez só | Pietro (apêndice C) |
| `POLP_SANDBOX` | Só em teste | `1` usa o ambiente de teste da Polp: dados fictícios, sem banco de verdade e sem cobrança. **Apagar antes de publicar** | — |
| `POLP_REDIRECT_URL` | Não | Página que devolve a pessoa ao app depois do banco: `https://pietromaffessoni.github.io/Baiu/open-finance/`. Só vale nos planos Pro e Ultra da Polp | Pietro (apêndice C) |
| `REVENUECAT_SECRET_KEY` | Para cobrar | Chave secreta v1 do RevenueCat (começa com `sk_`) | app.revenuecat.com (apêndice B) |

`SUPABASE_URL` e `SUPABASE_ANON_KEY` já existem em toda função. Não crie esses dois.

- [ ] `ANTHROPIC_API_KEY` cadastrada.
- [ ] `POLP_CLIENT_ID` e `POLP_CLIENT_SECRET` cadastrados. Isso depende do Pietro.
- [ ] `REVENUECAT_SECRET_KEY` cadastrada. Sem ela, as funções atendem qualquer pessoa logada, mesmo sem assinatura.
- [ ] Antes de publicar nas lojas: `POLP_SANDBOX` **apagado**.

Sem os segredos da IA ou da Polp, o app não quebra. A conversa usa respostas prontas e "Conectar banco" avisa que ainda não está disponível.

## 8. Ligar o app ao servidor

Em **Project Settings, API Keys**, pegue a URL do projeto e a chave **publishable** (começa com `sb_publishable_`). Essas duas são públicas e podem ser repassadas. A chave `secret` (ou `service_role`) **nunca** vai para o app.

- [ ] URL e chave publishable entregues ao Pietro, para o `.env.local` dele (modelo em `.env.example`).
- [ ] Variáveis criadas no EAS. Isso exige acesso à conta `pitroibas` no Expo:

  ```bash
  npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://SEU-PROJETO.supabase.co" --environment production --environment preview --environment development --visibility plaintext
  npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_KEY --value "sb_publishable_..." --environment production --environment preview --environment development --visibility plaintext
  ```

- [ ] Um build novo foi feito depois disso (`eas build`). Builds antigos não enxergam as variáveis novas.

## 9. Teste completo num celular

Use um build de desenvolvimento ou de teste instalado no celular. O Expo Go e a web não servem para bancos nem para compras.

**Contas**

- [ ] Criar conta: o código chega por e-mail e o cadastro termina.
- [ ] Em **Authentication, Users**, o usuário aparece com `full_name`, `phone`, `terms_version`, `privacy_version` e `adult` nos metadados.
- [ ] Os aceites foram gravados:

  ```sql
  select document, version, reference, accepted_at, revoked_at
  from public.consents
  where user_id = 'ID-DO-USUARIO'
  order by accepted_at;
  ```

  Resultado esperado: `termos`, `privacidade` e `maioridade`.
- [ ] Sair e entrar de novo com a senha.
- [ ] "Esqueci a senha": o código chega, a senha nova funciona e chega o e-mail de senha alterada.
- [ ] Editar nome ou celular em Minha conta salva sem erro.

**Assinatura** (com o RevenueCat configurado)

- [ ] Depois do cadastro aparece "Começar meu mês grátis". Assine com a conta Sandbox da Apple ou com um testador de licença do Google.
- [ ] No RevenueCat, em **Customers**, a pessoa aparece só com o id da conta.

**IA**

- [ ] Em **Conversar com o Baiu**, toque em **Ativar a conversa com IA** e pergunte algo. A resposta vem da IA.
- [ ] `consents` ganhou uma linha `assistente`, e `assistant_usage` ganhou a linha do dia com `count = 1`:

  ```sql
  select * from public.assistant_usage where user_id = 'ID-DO-USUARIO';
  ```

- [ ] Desativar a IA no app preenche `revoked_at` na linha `assistente`.

**Bancos** (com `POLP_SANDBOX=1`)

- [ ] Em **Conectar banco**, escolha qualquer banco e use um CPF válido (o seu, por exemplo). No ambiente de teste a autorização já volta aprovada, sem abrir o banco. Contas, cartões, movimentos e investimentos de teste aparecem no app.
- [ ] `bank_connections` ganhou uma linha com `products` preenchido, e `consents` ganhou uma linha `conexao_bancaria` com o id da autorização em `reference`.
- [ ] Desconectar o banco preenche `revoked_at` na linha de `bank_connections` (ela fica, para o histórico) e no aceite.
- [ ] Em Bancos conectados, "Suas autorizações" mostra a autorização como "Cancelada".

**Exclusão da conta**

- [ ] Exclua a conta de teste pelo app (Minha conta). Depois confira:
  - [ ] o usuário sumiu de **Authentication, Users**;
  - [ ] `consents`, `assistant_usage` e `bank_connections` não têm mais linhas desse id (saem juntas, em cascata);
  - [ ] a autorização aparece revogada no painel da Polp (**Consentimentos**);
  - [ ] a pessoa sumiu do RevenueCat (**Customers**).

**Logs**

- [ ] Em **Edge Functions, Logs** de cada função, aparecem só códigos de status. Nunca aparecem conversas, valores ou nomes. Se aparecer algo assim, avise o Pietro antes de publicar.

## 10. Segurança antes de publicar

- [ ] **Advisors, Security Advisor** sem erros (os avisos amarelos podem ser lidos e avaliados).
- [ ] **Advisors, Performance Advisor** sem erros.
- [ ] A chave `secret`/`service_role` não aparece em lugar nenhum fora do painel. Para conferir, procure no repositório e no `.env.local`.
- [ ] `POLP_SANDBOX` apagado (passo 7).
- [ ] Nenhuma tabela nova foi criada pelo painel sem migração (veja as regras abaixo).
- [ ] Backups diários ativos (**Database, Backups**, no plano Pro).

## 11. Conta para a revisão das lojas

A Apple e o Google precisam entrar no app para revisá-lo.

- [ ] Crie pelo próprio app uma conta só para isso, com um e-mail que vocês controlem.
- [ ] Passe o e-mail e a senha ao Pietro por um gerenciador de senhas. Eles vão nas notas de revisão das duas lojas.

## 12. Pedido de exclusão por e-mail

Quem não consegue abrir o app pode pedir a exclusão por e-mail (`docs/excluir-conta.md`). Antes de tudo, confirme que o pedido veio do e-mail cadastrado. Depois, apague o mesmo que o app apagaria:

1. No painel da Polp, em **Consentimentos**, revogue as autorizações com o id da pessoa (aparece como `cliente_user_id`).
2. No RevenueCat, em **Customers**, procure o id da pessoa e use **Delete customer**. Se a assinatura ainda estiver ativa, avise a pessoa de que o cancelamento é feito na loja.
3. No Supabase, em **Authentication, Users**, apague o usuário. Os aceites, as conexões e o contador saem junto.

- [ ] O sócio sabe fazer isso e tem acesso aos três painéis, ou combinou com o Pietro quem faz.

## 13. Regras para mudanças no banco daqui em diante

- Toda mudança no banco vira um arquivo **novo** em `supabase/migrations/`, com a data e a hora no nome (`AAAAMMDDHHMMSS_nome.sql`). Envie para a `main` e a integração aplica.
- Um arquivo que já rodou **não roda de novo**, mesmo se for editado. Para corrigir, crie outro arquivo.
- Não crie nem altere tabelas pelo **Table Editor**. A mudança fica fora do GitHub e se perde num projeto novo.
- Tabelas novas não são expostas sozinhas (a exposição automática está desligada). Cada uma precisa de `enable row level security`, `revoke all ... from anon, authenticated` e só o `grant` que fizer falta, como nos arquivos atuais.
- A integração **não** aplica configurações de login, modelos de e-mail, SMTP, segredos nem a opção de JWT das funções. Isso é sempre no painel.
- Os testes do SQL e das funções rodam no computador, sem servidor: `npm run test:sql`. Rode antes de enviar qualquer mudança nesta pasta.

## Quando algo dá errado

| Sintoma | Onde olhar |
| --- | --- |
| O código não chega por e-mail | Passo 5 (SMTP) e **Rate Limits**. Olhe também o spam |
| O e-mail chega com um link em vez do código | Passo 4: o modelo não foi trocado |
| O cadastro falha com "dados inválidos" | O gatilho `baiu_check_user` recusou o nome ou o celular. Veja **Logs, Postgres** |
| Toda chamada de função dá 401 | **Enforce JWT verification** ligado (passo 6) |
| "A conversa com IA ainda não está disponível" | Falta `ANTHROPIC_API_KEY`, a função `baiu-chat` não foi publicada ou a migração do assistente não rodou. O log da função diz qual |
| "Conectar banco" diz que não está disponível | Faltam as chaves da Polp, o plano da Polp está inativo ou com fatura atrasada, ou falta a migração dos bancos. O log da função `bank` diz qual |
| Assinante recebe o pedido para assinar | `REVENUECAT_SECRET_KEY` errada, ou direito de uso com nome diferente de `assinatura` (apêndice B) |
| Log com "aplique a migração..." | Passo 2 |

---

## Apêndice A: conta na Anthropic (IA)

1. Crie a conta em console.anthropic.com, de preferência com o e-mail do suporte.
2. Em **Billing**, cadastre o cartão, coloque créditos e defina um **limite de gasto mensal**.
3. Em **API Keys**, crie uma chave chamada `baiu-supabase`. Ela aparece uma vez só. Cole direto em `ANTHROPIC_API_KEY` (passo 7).

## Apêndice B: RevenueCat (assinatura)

Os produtos das lojas são configurados antes. Veja a seção Assinatura de `store/app-store.md` e de `store/google-play.md`.

1. Em app.revenuecat.com, crie um projeto chamado **Baiu**.
2. Adicione o app da **App Store** (bundle `com.pitroibas.baiu`), com a chave de compra dentro do app gerada no App Store Connect.
3. Adicione o app do **Google Play** (pacote `com.pitroibas.baiu`), com a conta de serviço. Os arquivos das duas lojas vão direto para o painel, nunca por mensagem.
4. Em **Product catalog, Entitlements**, crie o direito de uso com o identificador exato `assinatura`. Ligue a ele os produtos `baiu_mensal` (App Store) e `baiu_mensal:mensal` (Google Play).
5. Em **Offerings**, deixe a oferta `default` como atual, com o pacote **Monthly** apontando para os dois produtos.
6. Em **Project settings**, confira que **Restore behavior** está em "Transfer to new App User ID".
7. Em **Project settings, API keys**, faça duas coisas:
   - Copie as chaves públicas do SDK (`appl_...` e `goog_...`) para o `.env.local` e para o EAS, com os nomes `EXPO_PUBLIC_REVENUECAT_IOS_KEY` e `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Sem elas, o app não cobra ninguém.
   - Crie uma **Secret API key** da versão 1 (`sk_...`) e cole em `REVENUECAT_SECRET_KEY` (passo 7).

## Apêndice C: Polp (bancos), com o Pietro

O Pietro cuida desta parte. O sócio só precisa receber os segredos no Supabase (passo 7).

A Polp recebe os dados dos bancos pelo Open Finance por meio da Celcoin, instituição autorizada pelo Banco Central. O Baiu usa a API v2 (`https://api.polp.com.br/api/v2`). A API antiga, que usava a Pluggy, sai do ar em 28/11/2026 e não é usada.

1. Crie a conta em polp.com.br. O ambiente de teste (sandbox) não exige plano nem cobra nada.
2. No painel, gere as credenciais da API. O **client** (um UUID) vai em `POLP_CLIENT_ID` e o **secret** em `POLP_CLIENT_SECRET`. O secret aparece uma vez só: cole direto no Supabase.
3. Para testar, cadastre também `POLP_SANDBOX=1`. Apague antes de publicar.
4. Para usar com bancos de verdade, assine um plano. Sem plano ativo, ou com fatura atrasada, a Polp recusa as chamadas e o app avisa que a conexão não está disponível. Cada autorização aprovada é cobrada à parte.
5. Volta para o app depois do banco:
   - Ligue o GitHub Pages do repositório (**Settings, Pages**, ramo `main`, pasta `/docs`). A página `docs/open-finance/index.html` fica em `https://pietromaffessoni.github.io/Baiu/open-finance/` e abre o app.
   - No painel da Polp, configure esse endereço como URL de redirecionamento da conta, se o plano permitir.
   - Nos planos Pro e Ultra, cadastre também `POLP_REDIRECT_URL` com o mesmo endereço.
   - Sem isso, o app funciona do mesmo jeito: depois de autorizar, a pessoa volta ao Baiu sozinha e o app confere a autorização.
6. Antes de publicar, preencha no painel da Polp o **formulário de conformidade** da jornada do Open Finance e aceite os termos. A jornada do app segue o manual da Polp (polp.com.br/docs/celcoin/termos); os textos obrigatórios ficam em `src/lib/bank/consent-text.ts`. A Polp pode pedir capturas de tela numa auditoria.
