# Baiu no Google Play

Ficha pronta para copiar no Play Console e o passo a passo da publicação. As imagens estão em `store/imagens/google-play/`.

## Dados do app

| Campo | Valor |
| --- | --- |
| Nome do app | Baiu: Finanças Pessoais |
| Nome do pacote | com.pitroibas.baiu |
| Idioma padrão | Português (Brasil) – pt-BR |
| App ou jogo | App |
| Gratuito ou pago | Gratuito |
| Categoria | Finanças |
| Tags sugeridas | Finanças pessoais, Orçamento |
| E-mail de contato | o seu e-mail público de suporte |
| Site | https://github.com/PietroMaffessoni/Baiu/blob/main/docs/suporte.md |
| Política de privacidade | https://github.com/PietroMaffessoni/Baiu/blob/main/docs/privacidade.md |

## Descrição curta

Até 80 caracteres.

```
Organize contas, gastos e investimentos. O Baiu enche a cada bom hábito.
```

## Descrição completa

Até 4.000 caracteres.

```
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
Sem login, sem servidor e sem rastreamento. Seus dados ficam só no seu celular, criptografados com uma chave guardada no próprio aparelho. Dá para bloquear o app com a biometria e esconder os valores com um toque.

O Baiu é uma ferramenta de organização. Ele não se conecta ao seu banco, não movimenta dinheiro e não faz recomendação de investimento.
```

## Imagens

| Item | Arquivo | Exigência do Google |
| --- | --- | --- |
| Ícone | `icone-512.png` | 512 × 512, PNG |
| Gráfico de destaque | `banner-1024x500.jpg` | 1024 × 500, JPEG ou PNG sem transparência |
| Capturas de celular | `01-inicio.jpg` a `07-contas.jpg` | de 2 a 8, proporção 9:16 |

As capturas usam os dados de exemplo do próprio app.

## Conteúdo do app

Respostas para a seção Política, Conteúdo do app.

| Formulário | Resposta |
| --- | --- |
| Política de privacidade | A URL da tabela acima |
| Acesso ao app | Todas as funcionalidades estão disponíveis sem acesso especial |
| Anúncios | Não, o app não contém anúncios |
| Classificação do conteúdo | Categoria "Utilitário, produtividade, comunicação ou outro"; responda "não" a todas as perguntas. Deve resultar em Livre |
| Público-alvo | 18 anos ou mais. Responda que o app não é voltado a crianças |
| App de notícias | Não |
| Apps de saúde | Não |
| App governamental | Não |
| Recursos financeiros | Veja abaixo |
| Segurança dos dados | Veja abaixo |

### Recursos financeiros

O Baiu não oferece conta, empréstimo, pagamento, transferência real, negociação de ativos nem consultoria. Ele só organiza informações que o próprio usuário digita.

Abra o formulário e leia as opções. Se não houver uma opção específica para gestão de finanças pessoais ou orçamento, marque que o app não oferece recursos financeiros.

### Segurança dos dados

| Pergunta | Resposta |
| --- | --- |
| O app coleta ou compartilha algum dos tipos de dados exigidos? | Não |

Os dados do Baiu ficam só no aparelho e nunca são enviados para fora dele. Pelas regras do Google, dados processados apenas no aparelho não contam como coleta. Com essa resposta, o formulário termina e a ficha mostra "Nenhum dado coletado" e "Nenhum dado compartilhado com terceiros".

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
