# Baiu

Gestão financeira pessoal com um mascote que reage ao seu dinheiro. O Baiu é um baiacu-lanterna: quanto melhor você cuida das finanças, mais ele enche e mais forte é a luz dele.

Esta é a **versão 0.1, uma prévia visual**. Todas as contas, movimentos e investimentos são dados de exemplo salvos só no aparelho. A conexão real com bancos fica para a próxima etapa.

## Testar no celular

Pré-requisitos: Node 20 ou mais novo e o app **Expo Go** instalado no celular (SDK 57).

```bash
git clone https://github.com/PietroMaffessoni/Baiu.git
cd Baiu
npm install
npx expo start
```

1. Deixe o computador e o celular na mesma rede Wi-Fi.
2. No Android, abra o Expo Go e escaneie o QR code do terminal. No iPhone, escaneie com a câmera.
3. Se a rede bloquear a conexão, rode `npx expo start --tunnel`.

Para voltar ao começo: Ajustes, "Ver as boas-vindas de novo" ou "Restaurar dados de exemplo".

## O que dá para fazer

| Tela | O que mostra |
| --- | --- |
| Boas-vindas | O Baiu começa murcho e enche ao tocar em Começar |
| Início | Lanterna pendurada, saldo das contas, próximo passo, contas, últimos 30 dias, selos |
| Contas | Patrimônio líquido, composição, contas por tipo; tocar numa conta abre um resumo |
| Extrato | Movimentos agrupados por dia, filtro de entradas e saídas, faixa de gastos diários |
| Investir | Total investido, rendimento do mês, constância de aportes, carteira |
| Adicionar conta | Banco, tipo, valor com teclado numérico; o Baiu reage ao novo fôlego |
| Fôlego | Por que o Baiu está assim: quatro pilares de 25 pontos e o próximo hábito |
| Selos | Carimbos por hábitos saudáveis |

Segure o dedo no Baiu para ele estufar.

## Como o fôlego funciona

O fôlego vai de 0 a 100 e soma quatro pilares de 25 pontos, calculados sobre os últimos 30 dias:

1. **Gastou menos do que entrou:** cheio com gastos abaixo de 60% das entradas.
2. **Reserva de emergência:** cheio com seis meses de gastos guardados.
3. **Contas em dia:** cada conta vencida e não paga tira metade do pilar.
4. **Investiu este mês:** cheio investindo 15% do que entrou.

| Fôlego | Estado do Baiu |
| --- | --- |
| 0 a 24 | Murcho |
| 25 a 49 | Meio cheio |
| 50 a 74 | Cheio |
| 75 a 100 | Estufado |

A regra está em `src/lib/folego.ts`.

## Estrutura

```
src/
  app/            rotas (Expo Router): abas, conta/[id], nova-conta, folego, selos, ajustes, boas-vindas
  components/     peças de interface; o mascote fica em components/baiu/
  data/           tipos, bancos, categorias e dados de demonstração
  lib/            fôlego, resumos, selos, dinheiro e datas
  store/          estado do app com persistência local (AsyncStorage)
  theme/          cores, fontes e tipografia
assets/fonts/     Zen Maru Gothic recortada para caracteres latinos (licença OFL)
```

Documentos de produto e design: `PRODUCT.md` e `DESIGN.md`.

## Comandos

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
```

## Próximos passos

- Conexão com bancos via Open Finance ou agregador.
- Conta de usuário e sincronização na nuvem.
- Modo claro.
- Fórmula final do fôlego validada com usuários.
