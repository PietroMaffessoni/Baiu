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

Cadastre suas contas, registre entradas e gastos e veja o Baiu encher a cada bom hábito. Seus registros financeiros ficam só no seu celular, criptografados.

## Palavras-chave

finanças,orçamento,gastos,controle financeiro,reserva,investimentos,boletos,economia,dinheiro

## Descrição

O Baiu é um baiacu que enche conforme você cuida do seu dinheiro. Quanto melhores os hábitos, mais cheio e mais feliz ele fica.

CONECTE SEUS BANCOS
Pelo Open Finance, o sistema oficial do Banco Central, o Baiu traz suas contas, cartões, investimentos e cada entrada e saída, já separadas por categoria: salário, mercado, transporte, contas da casa. Você só confere. A senha fica no banco e o acesso é só para leitura.

REÚNA SUAS CONTAS
Conecte ou cadastre conta corrente, reserva, cartão de crédito e corretora. O Baiu soma tudo e mostra seu saldo e seu patrimônio em um lugar só.

REGISTRE O QUE ENTRA E O QUE SAI
Com os bancos conectados, tudo chega sozinho. Nas contas manuais, entradas, gastos e transferências em poucos toques. O extrato mostra cada dia do mês e quanto você guardou.

CONVERSE COM O BAIU
O Baiu fica de olho nos seus gastos e avisa quando algo foge do normal, como um mês com mais açaí do que o anterior ou uma conta de luz acima da média. Ele reconhece as contas que se repetem e responde suas dúvidas: onde economizar, como montar a reserva, por onde começar a investir. A conversa com inteligência artificial é opcional e só começa com a sua permissão.

ENTENDA SEU FÔLEGO
O fôlego vai de 0 a 100 e soma quatro pilares: gastar menos do que entrou, ter reserva de emergência, manter os vencimentos em dia e investir com constância. O app mostra a conta de cada pilar e o próximo passo para o Baiu encher.

NÃO PERCA UM VENCIMENTO
Cadastre boletos, aluguel e contas fixas. O Baiu avisa um dia antes e no dia, e renova os recorrentes sozinho.

ACOMPANHE SEUS INVESTIMENTOS
Registre suas aplicações, atualize os valores e veja quanto renderam no mês e quantos meses seguidos você investiu.

DO SEU JEITO
Escolha a cor do Baiu e veja ele se vestir sozinho no Natal, na Páscoa, no Halloween e em outras datas.

GANHE SELOS
Cada hábito saudável vira um carimbo: primeiro mês no azul, reserva de três meses, um ano investindo.

PRIVADO DE VERDADE
Sem anúncios e sem rastreamento. Seus registros financeiros ficam no seu celular, criptografados com uma chave guardada no próprio aparelho; nem os dados dos bancos conectados ficam no nosso servidor. Os avisos do Baiu são calculados no próprio aparelho. Dá para bloquear o app com Face ID e esconder os valores com um toque.

O Baiu é uma ferramenta de organização. Ele não movimenta dinheiro e não indica ativos específicos: as dicas são educativas.

## Privacidade do app

Em App Store Connect, Privacidade do app, declare que o app **coleta dados**, com estas respostas:

| Tipo de dado | Vinculado à pessoa | Usado para rastreamento | Finalidade |
| --- | --- | --- | --- |
| Informações de contato: Nome | Sim | Não | Funcionalidade do app |
| Informações de contato: Endereço de e-mail | Sim | Não | Funcionalidade do app |
| Informações de contato: Número de telefone | Sim | Não | Funcionalidade do app |
| Informações financeiras: Outras informações financeiras | Sim | Não | Funcionalidade do app |
| Conteúdo do usuário: Outro conteúdo do usuário | Não | Não | Funcionalidade do app |

Todos os outros tipos: não coletados. "Outras informações financeiras" cobre os bancos conectados pelo Open Finance (opcional): os dados vêm do banco pela Pluggy, que mantém a conexão ligada à conta da pessoa, e passam pelo nosso servidor até o aparelho. Por isso ficam vinculados. "Outro conteúdo do usuário" vem da conversa com IA, também opcional: com ela ligada, a pergunta e um resumo dos números (sem nome, e-mail, celular ou bancos) vão para a Anthropic a cada mensagem. O conteúdo da conversa não fica vinculado: nada que identifique a pessoa vai para a IA, e o servidor do Baiu não guarda o conteúdo. O manifesto de privacidade do app já declara esses cinco tipos.

A diretriz 5.1.2(i) da Apple pede que o app diga claramente quando dados pessoais vão para uma IA de terceiros e peça permissão antes. O Baiu mostra esse aviso, com o resumo exato do que é enviado, e só envia depois do toque em "Ativar a conversa com IA".

## Criptografia (conformidade de exportação)

O app já declara `ITSAppUsesNonExemptEncryption = false`, então o App Store Connect não pergunta nada a cada envio. A criptografia do Baiu só protege os dados do próprio usuário no aparelho, com algoritmos padrão, num app cuja função principal não é segurança da informação. Esse uso se enquadra nas isenções da regulação de exportação dos EUA. Se você quiser uma confirmação jurídica, consulte um advogado antes do envio.

## Informações para a revisão da Apple

- Login: necessário. Crie pelo app uma conta só para a revisão e informe e-mail e senha nos campos de login de demonstração.
- Notas para o revisor:

> Para ver o app com dados prontos, toque em "Explorar com dados de exemplo" na primeira tela; essa é a única parte sem conta. Para o uso real, entre com a conta de demonstração informada acima. Em Contas, "Conectar banco" abre a conexão pelo Open Finance (Pluggy). Também dá para cadastrar uma conta à mão e registrar um movimento pelo botão + na tela inicial. Os registros financeiros ficam só no aparelho, criptografados; o servidor guarda apenas nome, e-mail e celular. A conta pode ser excluída em Ajustes, Minha conta, Excluir conta. O bloqueio por Face ID é opcional e fica em Ajustes. As notificações locais lembram vencimentos cadastrados e avisam gastos fora do normal. O assistente abre pelo balão "Conversar com o Baiu" na tela inicial; no exemplo ele usa respostas prontas, e com a conta a conversa com inteligência artificial (Anthropic) é opcional e pede consentimento explícito antes do primeiro envio, mostrando o que será enviado.

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
| 8 | `08-personalizar.jpg` | Do seu jeito |

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
