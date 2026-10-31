# Baiu no Google Play

Ficha pronta para copiar no Play Console e o passo a passo da publicação. As imagens estão em `store/imagens/google-play/`.

## Dados do app

| Campo | Valor |
| --- | --- |
| Nome do app | Baiu: Finanças Pessoais |
| Nome do pacote | com.pitroibas.baiu |
| Idioma padrão | Português (Brasil) – pt-BR |
| App ou jogo | App |
| Gratuito ou pago | Gratuito, com compras no app (assinatura mensal com primeiro mês grátis) |
| Categoria | Finanças |
| Tags sugeridas | Finanças pessoais, Orçamento |
| E-mail de contato | suporte.baiu@gmail.com |
| Site | https://github.com/PietroMaffessoni/Baiu/blob/main/docs/suporte.md |
| Política de privacidade | https://github.com/PietroMaffessoni/Baiu/blob/main/docs/privacidade.md |
| Exclusão de conta | https://github.com/PietroMaffessoni/Baiu/blob/main/docs/excluir-conta.md |

## Descrição curta

Até 80 caracteres.

```
Organize contas, gastos e investimentos. O Baiu enche a cada bom hábito.
```

## Descrição completa

Até 4.000 caracteres.

```
O Baiu é um baiacu que enche conforme você cuida do seu dinheiro. Quanto melhores os hábitos, mais cheio e mais feliz ele fica.

CONECTE SEUS BANCOS
Pelo Open Finance, o sistema oficial do Banco Central, o Baiu traz suas contas, cartões, investimentos e cada entrada e saída, já separadas por categoria: salário, mercado, transporte, contas da casa. Você só confere. A senha fica no banco e o acesso é só para leitura.

REÚNA SUAS CONTAS
Conecte ou cadastre conta corrente, reserva, cartão de crédito e corretora. O Baiu soma tudo e mostra seu saldo e seu patrimônio em um lugar só.

REGISTRE O QUE ENTRA E O QUE SAI
Com os bancos conectados, tudo chega sozinho. Nas contas manuais, entradas, gastos e transferências em poucos toques. O extrato mostra cada dia do mês e quanto você guardou.

CONVERSE COM O BAIU
O Baiu fica de olho nos seus gastos e avisa quando algo foge do normal, como um mês com mais açaí do que o anterior ou uma conta de luz acima da média. Ele reconhece as contas que se repetem e responde suas dúvidas: onde economizar, como montar a reserva, por onde começar a investir. Tudo calculado no seu celular.

ENTENDA SEU FÔLEGO
O fôlego vai de 0 a 100 e soma quatro pilares: gastar menos do que entrou, ter reserva de emergência, manter os vencimentos em dia e investir com constância. O app mostra a conta de cada pilar e o próximo passo para o Baiu encher.

NÃO PERCA UM VENCIMENTO
Cadastre boletos, aluguel e contas fixas. O Baiu avisa um dia antes e no dia, e renova os recorrentes sozinho.

ACOMPANHE SEUS INVESTIMENTOS
Registre suas aplicações, atualize os valores e veja quanto renderam no mês e quantos meses seguidos você investiu.

GANHE SELOS
Cada hábito saudável vira um carimbo: primeiro mês no azul, reserva de três meses, um ano investindo.

PRIVADO DE VERDADE
Sem anúncios e sem rastreamento. Seus registros financeiros ficam no seu celular, criptografados com uma chave guardada no próprio aparelho; nem os dados dos bancos conectados ficam no nosso servidor. Os avisos do Baiu são calculados no próprio aparelho. Dá para bloquear o app com a biometria e esconder os valores com um toque.

ASSINATURA
O primeiro mês é grátis. Depois, a assinatura do Baiu é cobrada todo mês pela Google Play e renova sozinha até você cancelar. Cancele quando quiser em Ajustes, Assinatura, até 24 horas antes da renovação. O Baiu avisa 2 dias antes de o mês grátis acabar.
Termos de uso: https://github.com/PietroMaffessoni/Baiu/blob/main/docs/termos.md
Política de privacidade: https://github.com/PietroMaffessoni/Baiu/blob/main/docs/privacidade.md

O Baiu é uma ferramenta de organização. Ele não movimenta dinheiro e não indica ativos específicos: as dicas são educativas.
```

## Imagens

| Item | Arquivo | Exigência do Google |
| --- | --- | --- |
| Ícone | `icone-512.png` | 512 × 512, PNG |
| Gráfico de destaque | `banner-1024x500.jpg` | 1024 × 500, JPEG ou PNG sem transparência |
| Capturas de celular | `01-inicio.jpg` a `07-investir.jpg` | de 2 a 8, proporção 9:16 |

Ordem e legendas: início ("Seu dinheiro com fôlego"), bancos conectados, o Baiu assistente, fôlego, extrato, vencimentos e investimentos. As capturas usam os dados de exemplo do próprio app; a de bancos usa o banco de teste. Para refazer: `npm run store:images`.

## Conteúdo do app

Respostas para a seção Política, Conteúdo do app.

| Formulário | Resposta |
| --- | --- |
| Política de privacidade | A URL da tabela acima |
| Acesso ao app | Algumas funcionalidades exigem login. Informe o e-mail e a senha da conta criada para a revisão |
| Anúncios | Não, o app não contém anúncios |
| Classificação do conteúdo | Categoria "Utilitário, produtividade, comunicação ou outro"; responda "não" a todas as perguntas. Deve resultar em Livre |
| Público-alvo | 18 anos ou mais. Responda que o app não é voltado a crianças |
| App de notícias | Não |
| Apps de saúde | Não |
| App governamental | Não |
| Recursos financeiros | Veja abaixo |
| Segurança dos dados | Veja abaixo |

### Recursos financeiros

O Baiu não oferece conta, empréstimo, pagamento, transferência real, negociação de ativos nem consultoria. Ele organiza o que o usuário digita e, se a pessoa quiser, o que vem dos bancos dela pelo Open Finance, só para leitura.

Abra o formulário e leia as opções. Com a conexão de bancos, o Baiu agrega contas pelo Open Finance (só leitura), sem fazer pagamentos nem empréstimos. Marque a opção de gestão de finanças pessoais ou agregação de contas, se houver; não marque pagamentos, empréstimos nem investimentos.

### Segurança dos dados

| Pergunta | Resposta |
| --- | --- |
| O app coleta ou compartilha algum dos tipos de dados exigidos? | Sim |
| Todos os dados coletados são criptografados em trânsito? | Sim |
| Os usuários podem pedir a exclusão dos dados? | Sim, no app e pela URL de exclusão de conta |
| Informações pessoais: Nome | Coletado, não compartilhado, obrigatório, para gerenciamento da conta |
| Informações pessoais: Endereço de e-mail | Coletado, não compartilhado, obrigatório, para gerenciamento da conta |
| Informações pessoais: Número de telefone | Coletado, não compartilhado, obrigatório, para gerenciamento da conta |
| Informações pessoais: IDs de usuário | Coletado, não compartilhado, obrigatório, para funcionalidade do app e gerenciamento da conta |
| Informações financeiras: Histórico de compras | Coletado, não compartilhado, obrigatório, para funcionalidade do app |
| Informações financeiras: Outras informações financeiras | Coletado, não compartilhado, opcional, para funcionalidade do app |

Todos os outros tipos: não coletados. Os registros financeiros ficam só no aparelho e, pelas regras do Google, dados processados apenas no aparelho não contam como coleta. A linha opcional vem dos bancos conectados pelo Open Finance (movimentos, saldos e investimentos chegam pela Celcoin e pela Polp e passam pelo nosso servidor até o aparelho). A conversa com IA está desligada nesta versão; quando voltar, declare também "Outros conteúdos gerados pelo usuário". O histórico de compras e o ID de usuário vêm da assinatura: o RevenueCat recebe o id da conta (um código aleatório) e os recibos do Google Play para saber se a assinatura está ativa. O Supabase, a Polp, a Celcoin e o RevenueCat são prestadores de serviço, então não contam como compartilhamento.

### Exclusão de conta

Em "Conteúdo do app", Exclusão de conta, informe a URL da tabela acima. A página explica como excluir pelo app e por e-mail.

## Assinatura (compras no app)

1. Em **Configuração, Perfil de pagamentos**, crie o perfil de comerciante e preencha os dados bancários. Sem ele, não dá para vender.
2. O Google só libera a criação de assinaturas depois que um build com a biblioteca de compras foi enviado. Envie primeiro o `.aab` para o teste fechado (passo 4 abaixo).
3. Em **Monetizar, Produtos, Assinaturas**, crie:

| Campo | Valor |
| --- | --- |
| ID do produto | `baiu_mensal` |
| Nome | Baiu mensal |
| Plano básico | ID `mensal`, renovação automática, a cada 1 mês, preço escolhido (R$ 24,90 por mês) |
| Oferta | ID `mes-gratis`, teste gratuito de 1 mês, para quem nunca teve esta assinatura |

4. Ative o plano básico e a oferta.
5. Plano anual: crie a assinatura `baiu_anual` (nome Baiu anual) com o plano básico `anual`, renovação automática a cada 1 ano, R$ 229,90, e ative. No RevenueCat, ligue-a ao mesmo direito de uso `assinatura`.
6. Em **Configuração, Teste de licença**, adicione os e-mails de quem vai testar: as compras deles não são cobradas.
7. O RevenueCat precisa ler as compras: siga o guia dele para dar acesso a uma conta de serviço (pode ser a mesma do envio automático, com a permissão de dados financeiros) e para ligar as notificações em tempo real (Pub/Sub). O arquivo da conta de serviço vai direto para o painel do RevenueCat, nunca por mensagem.

O resto da configuração está em `supabase/LEIA-ME.md`, apêndice B.

## Passo a passo para publicar

O que só você pode fazer, porque depende da sua conta Google:

1. Crie a conta de desenvolvedor pessoal em play.google.com/console. A taxa é de US$ 25, paga uma vez. Conclua a verificação de identidade e a do celular Android.
2. Crie o app: Criar app, com os dados da tabela acima. Aceite as declarações.
3. Preencha "Conteúdo do app" e a "Página principal da loja" com este documento.
4. Em Testes, Teste fechado, crie uma faixa e envie à mão o arquivo `.aab` do build de produção. O Google exige que o primeiro envio seja feito pelo navegador. Para baixar o arquivo:

```bash
npx eas-cli build:list --platform android --limit 1
```

5. Adicione pelo menos 12 testadores por e-mail ou por um Grupo do Google e mande o link de participação para eles. Cada um precisa aceitar o convite e instalar o app pela Play Store.
6. Mantenha os 12 inscritos por 14 dias seguidos. Nesse período, publique ao menos uma atualização com correções que surgirem.
7. Em Painel, peça o acesso à produção e responda ao questionário sobre o teste.
8. Com o acesso liberado, crie a versão de produção, promova o build e envie para revisão.

### Envio automático depois do primeiro

Para que o EAS envie as próximas versões sozinho:

1. No Google Cloud, crie uma conta de serviço e gere uma chave JSON.
2. No Play Console, em Usuários e permissões, convide o e-mail da conta de serviço com permissão para gerenciar versões.
3. Salve a chave como `google-service-account.json` na raiz do projeto. Esse nome já está no `.gitignore`, então ela não vai para o GitHub.
4. Envie:

```bash
npx eas-cli submit --platform android --latest
```

O `eas.json` envia para o teste fechado como rascunho. Depois da liberação para produção, troque `track` para `production`.
