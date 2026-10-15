# Servidor de contas do Baiu (Supabase)

O cadastro e o login do Baiu usam o Supabase. Os registros financeiros continuam só no aparelho; o servidor guarda apenas nome, e-mail, celular, senha protegida e os aceites dos termos.

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

Com isso, cada envio para a `main` aplica sozinho os arquivos novos de `supabase/migrations/`. O primeiro envio cria a tabela de aceites, a validação do cadastro no servidor e a função de excluir conta.

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

## 7. Conta para a revisão das lojas

A Apple e o Google precisam entrar no app. Crie pelo próprio app uma conta só para isso, com um e-mail que vocês controlem, e informe e-mail e senha nas notas de revisão das duas lojas.
