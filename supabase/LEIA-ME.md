# Servidor de contas do Baiu (Supabase)

O cadastro, o login, a conversa com IA, a conexão com bancos e a conferência da assinatura do Baiu usam o Supabase. Os registros financeiros continuam só no aparelho; o servidor guarda apenas nome, e-mail, celular, senha protegida, os aceites, quais bancos estão conectados e um contador diário de perguntas à IA. Saldos e movimentos dos bancos passam pelo servidor só a caminho do aparelho.

Siga os passos na ordem. Cada um diz onde clicar no painel do Supabase.

## 1. Criar o projeto

1. Crie uma conta em supabase.com e um projeto novo.
2. Nome: `baiu`. Região: **South America (São Paulo)**. A política de privacidade diz que os dados ficam no Brasil, então a região precisa ser essa.
3. Guarde a senha do banco num gerenciador de senhas.

## 2. Aplicar o SQL

O projeto está ligado ao GitHub. Confira em **Project Settings, Integrations, GitHub**:

| Campo | Valor |
| --- | --- |
| Working directory | `.` |
| Production branch | `main` |
| Deploy to production | Ligado |

Com isso, cada envio para a `main` aplica sozinho os arquivos novos de `supabase/migrations/`. São três: o das contas (aceites, validação do cadastro e exclusão da conta), o do assistente (aceite da IA e limite diário) e o dos bancos (conexões e aceite do Open Finance).

Regras daqui em diante:

- Mudança no banco vira um arquivo novo em `supabase/migrations/`. Um arquivo que já rodou não roda de novo, mesmo se for editado.
- A integração não aplica as configurações de login nem os modelos de e-mail. Os passos 3 e 4 são feitos no painel.

Depois disso, contas só podem ser criadas pelo app. Criar usuário pelo painel ou por convite falha, porque faltam nome, celular e aceites.

## 3. Ajustar a autenticação

Em **Authentication**:

| Onde | O que fazer |
| --- | --- |
| Sign In / Providers, Email | Ligado. **Confirm email** ligado. **Secure email change** ligado |
| Sign In / Providers, Email | **Email OTP Length**: 6. **Email OTP Expiration**: 3600 |
| Sign In / Providers, Email | Senha mínima: 8. Exigir minúsculas, maiúsculas, números e símbolos |
| Sign In / Providers | Telefone, login anônimo e redes sociais desligados |
| Sign In / Providers | **Allow new users to sign up** ligado |
| Rate Limits | Pode manter o padrão |

## 4. Modelos de e-mail

Em **Authentication, Emails, Templates**, troque o assunto e o corpo de cada modelo pelo arquivo correspondente em `supabase/templates/`. O assunto está na primeira linha de cada arquivo.

| Modelo no Supabase | Arquivo |
| --- | --- |
| Confirm signup | `confirmar-cadastro.html` |
| Reset Password | `recuperar-senha.html` |
| Password changed, em Security notifications | `senha-alterada.html` |

Os modelos mostram o código `{{ .Token }}` em vez de um link. O app pede esse código, então não é preciso configurar links de retorno.

## 5. Envio de e-mails (obrigatório antes de publicar)

O envio padrão do Supabase serve só para testes: manda poucos e-mails por hora e só para membros da equipe do projeto. Para clientes reais, configure um SMTP próprio em **Authentication, Emails, SMTP Settings**.

Opções:

- **Rápida:** o Gmail do suporte. Ligue a verificação em duas etapas em suporte.baiu@gmail.com, crie uma "senha de app" e use `smtp.gmail.com`, porta 465. O Gmail limita a cerca de 500 e-mails por dia.
- **Recomendada:** um domínio próprio, como baiu.app, com um provedor de e-mail transacional como Resend ou Brevo. Os e-mails chegam melhor e não caem no spam.

## 6. Ligar o app ao servidor

Em **Project Settings, API Keys**, copie a URL do projeto e a chave pública (publishable). Nunca use a chave `service_role` ou `secret` no app.

No computador, crie o arquivo `.env.local` na raiz do projeto, seguindo o `.env.example`.

Para os builds do EAS:

```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://SEU-PROJETO.supabase.co" --environment production --environment preview --environment development --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_KEY --value "sb_publishable_..." --environment production --environment preview --environment development --visibility plaintext
```

## 7. Conversa com IA (assistente)

Sem este passo o app funciona normalmente: o Baiu avisa gastos fora do normal e responde com respostas prontas. A conversa com inteligência artificial só aparece depois dele.

### 7.1 Conta na Anthropic

1. Crie uma conta em console.anthropic.com, de preferência com o e-mail do suporte.
2. Em **Billing**, cadastre o cartão e coloque créditos. Defina um **limite de gasto mensal** para não ter surpresa.
3. Em **API Keys**, crie uma chave chamada `baiu-supabase`. Ela aparece uma vez só; copie direto para o passo 7.2. Essa chave é secreta: nunca vai para o app, para o GitHub nem para mensagens.

### 7.2 Segredos da função

No Supabase, em **Edge Functions, Secrets**, adicione:

| Nome | Valor |
| --- | --- |
| `ANTHROPIC_API_KEY` | a chave criada no passo anterior |
| `BAIU_AI_MODEL` | opcional; padrão `claude-opus-5-5`. Para gastar menos: `claude-sonnet-5-5` ou `claude-haiku-5-5` |
| `BAIU_AI_DAILY_LIMIT` | opcional; perguntas por pessoa por dia, padrão 30 |

### 7.3 Publicar a função

A função fica em `supabase/functions/baiu-chat/index.ts` e tem um arquivo só.

Se a integração com o GitHub não publicar sozinha, publique pelo painel: **Edge Functions, Deploy a new function, Via Editor**, nome `baiu-chat`, cole o conteúdo do arquivo e clique em **Deploy function**. A cada mudança no arquivo, repita.

Depois, nos detalhes da função, desligue **Enforce JWT verification** (ou **Verify JWT**). A própria função confere o login pelo banco, e a verificação automática não funciona com as chaves novas do Supabase.

### 7.4 Conferir

No app, entre com uma conta, abra **Conversar com o Baiu**, toque em **Ativar a conversa com IA** e pergunte algo. Se aparecer "A conversa com IA ainda não está disponível", confira:

- a migração do assistente rodou: a tabela `assistant_usage` aparece em **Table Editor**;
- o segredo `ANTHROPIC_API_KEY` existe;
- em **Edge Functions, baiu-chat, Logs**, a função registra só códigos de erro, nunca o conteúdo das conversas.

## 8. Conexão com bancos (Open Finance)

Sem este passo o app funciona com contas digitadas à mão, e a opção "Conectar banco" avisa que ainda não está disponível.

### 8.1 Conta na Pluggy

1. Crie a conta em dashboard.pluggy.ai e um aplicativo (Application) chamado Baiu.
2. Copie o **Client ID** e o **Client Secret**. O segredo é como uma senha: nunca vai para o app, para o GitHub nem para mensagens.
3. Para produção, fale com a Pluggy: o acesso ao Open Finance, a categorização automática e a atualização automática dependem de contrato. Peça os produtos ACCOUNTS, CREDIT_CARDS, TRANSACTIONS, INVESTMENTS e a categorização (enrichment).

### 8.2 Segredos da função

Em **Edge Functions, Secrets**, adicione:

| Nome | Valor |
| --- | --- |
| `PLUGGY_CLIENT_ID` | o Client ID |
| `PLUGGY_CLIENT_SECRET` | o Client Secret |
| `PLUGGY_SANDBOX` | `1` enquanto estiver testando, para aparecer o "Pluggy Bank" de teste no widget. Tire antes de publicar |

### 8.3 Publicar a função

A função fica em `supabase/functions/bank/index.ts`, num arquivo só. Publique do mesmo jeito que a `baiu-chat` (passo 7.3), com o nome `bank`, e desligue **Enforce JWT verification**: a função confere o login sozinha.

### 8.4 Conferir

1. Instale um build de desenvolvimento ou de teste no celular. O widget usa `react-native-webview` e não roda no Expo Go antigo nem na web.
2. Entre com uma conta, toque em **Conectar banco**, escolha **Pluggy Bank** e use usuário `user-ok` e senha `password-ok`.
3. Confira se as contas, os movimentos e os investimentos aparecem, e se a tabela `bank_connections` ganhou uma linha.

## 9. Assinatura (RevenueCat)

Sem este passo o app funciona sem cobrança. Antes, configure os produtos nas lojas: `store/app-store.md` e `store/google-play.md`, seção Assinatura.

### 9.1 Conta no RevenueCat

1. Crie a conta em app.revenuecat.com e um projeto chamado **Baiu**.
2. Adicione o app da **App Store** (bundle `com.pitroibas.baiu`) com a chave de compra dentro do app gerada no App Store Connect, e o app do **Google Play** (pacote `com.pitroibas.baiu`) com a conta de serviço. Os arquivos vão direto para o painel, nunca por mensagem.
3. Em **Product catalog, Entitlements**, crie o direito de uso com o identificador exato `assinatura` e ligue a ele os produtos `baiu_mensal` (App Store) e `baiu_mensal:mensal` (Google Play).
4. Em **Offerings**, deixe a oferta `default` como atual, com o pacote **Monthly** apontando para os dois produtos. Um plano anual entra como pacote **Annual**, sem mexer no app.
5. Em **Project settings**, confira que **Restore behavior** está em "Transfer to new App User ID" (o padrão).

### 9.2 Chaves no app

Em **Project settings, API keys**, copie as chaves públicas do SDK: a da App Store começa com `appl_` e a do Google Play com `goog_`. Elas são feitas para ficar no app. Coloque no `.env.local` e no EAS:

```bash
npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_..." --environment production --environment preview --environment development --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value "goog_..." --environment production --environment preview --environment development --visibility plaintext
```

Sem essas chaves, o app não cobra ninguém. Não publique nas lojas sem elas.

### 9.3 Segredo no servidor

Na mesma página, crie uma **Secret API key** da versão 1 (começa com `sk_`). Ela é como uma senha: nunca vai para o app, para o GitHub nem para mensagens. Em **Edge Functions, Secrets**, adicione:

| Nome | Valor |
| --- | --- |
| `REVENUECAT_SECRET_KEY` | a chave secreta |

Com ela, as funções `bank` e `baiu-chat` só atendem quem tem a assinatura ativa. Desconectar bancos e excluir a conta continuam liberados.

### 9.4 Publicar as funções

1. Publique a função nova `supabase/functions/subscription/index.ts` com o nome `subscription`, do mesmo jeito que a `baiu-chat` (passo 7.3), e desligue **Enforce JWT verification**. Ela apaga o cadastro no RevenueCat quando a pessoa exclui a conta.
2. Publique de novo a `bank` e a `baiu-chat`: as duas mudaram para conferir a assinatura.

### 9.5 Conferir

1. Instale um build de desenvolvimento ou de teste (as compras não funcionam no Expo Go nem na web) e entre no celular com a conta Sandbox da Apple ou com um testador de licença do Google.
2. Crie uma conta no app. A tela de assinatura aparece com "Começar meu mês grátis". Assine.
3. Confira em Ajustes, Assinatura: "Mês grátis até…" e o botão de cancelar. No RevenueCat, em **Customers**, a pessoa aparece só com o código da conta.
4. Cancele pela loja e volte ao app: a tela mostra "Assinatura cancelada". No sandbox, o mês acaba em minutos e o app volta para a tela de assinatura, agora sem o mês grátis.
5. Exclua a conta de teste e confira que ela some de **Customers**.

## 10. Conta para a revisão das lojas

A Apple e o Google precisam entrar no app. Crie pelo próprio app uma conta só para isso, com um e-mail que vocês controlem, e informe e-mail e senha nas notas de revisão das duas lojas.

## 11. Pedido de exclusão por e-mail

Quem não consegue abrir o app pode pedir a exclusão por e-mail (`docs/excluir-conta.md`). Depois de confirmar que o pedido veio do e-mail cadastrado, apague tudo o que o app apagaria sozinho:

1. Na Pluggy, em **Items**, apague as conexões com o id da pessoa (aparece como `clientUserId`).
2. No RevenueCat, em **Customers**, procure o id da pessoa e use **Delete customer**. Se a assinatura ainda estiver ativa, avise a pessoa de que o cancelamento é feito na loja.
3. No Supabase, em **Authentication, Users**, apague o usuário. Os aceites e as conexões saem junto.
