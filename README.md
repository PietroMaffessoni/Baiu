# Baiu

Gestão financeira pessoal com um mascote que reage ao seu dinheiro. O Baiu é um baiacu-lanterna: quanto melhor você cuida das finanças, mais ele enche e mais forte é a luz dele.

Versão 1.0. Tudo fica só no aparelho, criptografado. Não há login, servidor, anúncios nem analytics.

## O que o app faz

| Área | O que dá para fazer |
| --- | --- |
| Contas | Conta corrente, reserva, cartão de crédito e corretora, com saldo informado pelo usuário |
| Movimentos | Entradas, saídas e transferências, com categoria, forma de pagamento e data; editar e apagar |
| Cartão | Fatura como dívida; transferir para o cartão paga a fatura |
| Vencimentos | Boletos e contas fixas, recorrência mensal, pagamento que vira saída no extrato |
| Investimentos | Aplicações, aportes de outra conta, atualização de valor, resgates e constância mensal |
| Fôlego | Nota de 0 a 100 em quatro pilares, com o próximo passo em reais |
| Selos | Carimbos por hábitos saudáveis |
| Segurança | Dados cifrados, bloqueio por Face ID ou biometria, ocultar valores, cortina no seletor de apps |
| Lembretes | Notificação local um dia antes e no dia do vencimento, sem valores no texto |
| Seus dados | Exportação em CSV e exclusão total |

Na primeira tela, "Explorar com dados de exemplo" carrega um mês fictício. Para sair dele: Ajustes, "Sair do modo exemplo".

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

## Rodar no computador

Pré-requisito: Node 20 ou mais novo.

```bash
npm install
npx expo start
```

O Face ID, as notificações e o cofre no Keychain precisam de um build de desenvolvimento ou de teste. No Expo Go parte disso não funciona.

```bash
npx eas-cli build --platform android --profile preview   # APK para instalar direto
npx eas-cli build --platform ios --profile preview       # pede o login da Apple
```

## Comandos

```bash
npm test            # testes de lógica (saldos, fôlego, vencimentos, investimentos, cripto, CSV)
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
  store/          estado do app e redutor
  theme/          cores, fontes e tipografia
docs/             privacidade, termos e suporte, publicados pelo GitHub
store/            fichas da App Store e do Google Play e imagens das lojas
```

Documentos de produto e design: `PRODUCT.md` e `DESIGN.md`.

## Publicação

O passo a passo está em `store/app-store.md` e `store/google-play.md`.
