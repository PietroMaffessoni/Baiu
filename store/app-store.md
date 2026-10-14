# Baiu na App Store

Ficha pronta para copiar no App Store Connect, e o passo a passo do que precisa da sua conta Apple.

## Dados do app

| Campo | Valor |
| --- | --- |
| Nome | Baiu: Finanças Pessoais |
| Subtítulo | Seu dinheiro com fôlego |
| Idioma principal | Português (Brasil) |
| Bundle ID | com.pitroibas.baiu |
| SKU | baiu-ios |
| Categoria principal | Finanças |
| Categoria secundária | Produtividade |
| Preço | Gratuito |
| Classificação etária | 4+ (responda "não" a todas as perguntas do questionário) |
| URL de suporte | https://github.com/PietroMaffessoni/Baiu/blob/main/docs/suporte.md |
| URL da política de privacidade | https://github.com/PietroMaffessoni/Baiu/blob/main/docs/privacidade.md |
| Copyright | 2026 Pietro Maffessoni |

## Texto promocional

Cadastre suas contas, registre entradas e gastos e veja o Baiu encher a cada bom hábito. Tudo fica só no seu celular, criptografado.

## Palavras-chave

finanças,orçamento,gastos,controle financeiro,reserva,investimentos,boletos,economia,dinheiro

## Descrição

O Baiu é um baiacu-lanterna que acende conforme você cuida do seu dinheiro. Quanto melhores os hábitos, mais cheio e mais brilhante ele fica.

REÚNA SUAS CONTAS
Cadastre conta corrente, reserva, cartão de crédito e corretora. O Baiu soma tudo e mostra seu saldo e seu patrimônio em um lugar só.

REGISTRE O QUE ENTRA E O QUE SAI
Entradas, gastos e transferências em poucos toques, com categorias, forma de pagamento e data. O extrato mostra cada dia do mês e quanto você guardou.

ENTENDA SEU FÔLEGO
O fôlego vai de 0 a 100 e soma quatro pilares: gastar menos do que entrou, ter reserva de emergência, manter os vencimentos em dia e investir com constância. O app mostra a conta de cada pilar e o próximo passo para o Baiu encher.

NÃO PERCA UM VENCIMENTO
Cadastre boletos, aluguel e contas fixas. O Baiu avisa um dia antes e no dia, e renova os recorrentes sozinho.

ACOMPANHE SEUS INVESTIMENTOS
Registre suas aplicações, atualize os valores e veja quanto renderam no mês e quantos meses seguidos você investiu.

GANHE SELOS
Cada hábito saudável vira um carimbo: primeiro mês no azul, reserva de três meses, um ano investindo.

PRIVADO DE VERDADE
Sem login, sem servidor e sem rastreamento. Seus dados ficam só no seu celular, criptografados com uma chave guardada no próprio aparelho. Dá para bloquear o app com Face ID e esconder os valores com um toque.

O Baiu é uma ferramenta de organização. Ele não se conecta ao seu banco, não movimenta dinheiro e não faz recomendação de investimento.

## Privacidade do app

No App Store Connect, em Privacidade do app, responda que **não coleta dados** deste app. É a resposta correta: nada sai do aparelho, não há analytics, anúncios nem relatórios de erro remotos.

## Criptografia (conformidade de exportação)

O app já declara `ITSAppUsesNonExemptEncryption = false`, então o App Store Connect não pergunta nada a cada envio. A criptografia do Baiu só protege os dados do próprio usuário no aparelho, com algoritmos padrão, num app cuja função principal não é segurança da informação. Esse uso se enquadra nas isenções da regulação de exportação dos EUA. Se você quiser uma confirmação jurídica, consulte um advogado antes do envio.

## Informações para a revisão da Apple

- Login: não é necessário.
- Notas para o revisor:

> O Baiu não tem login nem servidor. Para ver o app com dados, toque em "Explorar com dados de exemplo" na primeira tela. Para testar o uso real, toque em "Começar", cadastre uma conta e registre um movimento pelo botão + na tela inicial. Todos os dados ficam no aparelho, criptografados. O bloqueio por Face ID é opcional e fica em Ajustes. As notificações locais lembram vencimentos cadastrados.

- Contato da revisão: seu nome, telefone e e-mail.

## Capturas de tela

As capturas já estão prontas em `store/imagens/app-store/`, no tamanho de iPhone de 6,9 polegadas (1320 × 2868). O app não roda em iPad, então não precisa de capturas de iPad.

| Ordem | Arquivo | Legenda |
| --- | --- | --- |
| 1 | `01-inicio.jpg` | Seu dinheiro com fôlego |
| 2 | `02-folego.jpg` | Entenda sua nota |
| 3 | `03-registrar.jpg` | Registre em segundos |
| 4 | `04-extrato.jpg` | Veja para onde foi |
| 5 | `05-investir.jpg` | Investimentos em dia |
| 6 | `06-vencimentos.jpg` | Nenhum vencimento esquecido |
| 7 | `07-contas.jpg` | Tudo num lugar só |

Elas usam os dados de exemplo do próprio app.

## Passo a passo para publicar

O que só você pode fazer, porque depende da sua conta Apple:

1. Entre no Apple Developer Program (US$ 99 por ano) em developer.apple.com.
2. No App Store Connect, crie o app: Apps, botão +, Novo app. Use os dados da tabela acima.
3. Gere o build de produção. O EAS pede o login da Apple e cria certificados e perfis sozinho:

```bash
npx eas-cli build --platform ios --profile production
```

4. Envie para o App Store Connect:

```bash
npx eas-cli submit --platform ios --latest
```

5. Teste pelo TestFlight, principalmente o Face ID e as notificações, que não funcionam no Expo Go.
6. Preencha a ficha com este documento, envie as capturas e mande para revisão.

## Google Play

A ficha e o passo a passo estão em `store/google-play.md`.

## Teste em aparelho antes da loja

Para instalar uma versão completa no seu celular, com Face ID e notificações:

```bash
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview
```

No iPhone, o EAS pede para registrar o aparelho (`npx eas-cli device:create`) antes do build de teste.
