# Product

<!-- impeccable:product-schema 1 -->

> Registro escrito sem rodada de entrevista: o usuário delegou a identidade inteira e pediu o app pronto para o Expo Go ao fim do primeiro comando. Itens marcados [inferido] vieram do briefing, não de confirmação.

## Platform

adaptive

## Stack

Expo SDK 57 + expo-router + TypeScript, rodando no Expo Go. [inferido: o usuário pediu para testar "no Expo do celular"; os outros apps dele (Zelo, Campeonatos CA) usam a mesma base.] Sem backend na v0: dados de demonstração locais.

## Users

Pessoa física brasileira que usa várias contas (conta corrente, banco digital, poupança, corretora) para receber e fazer todo tipo de pagamento. Quer entender para onde o dinheiro vai, controlar gastos e acompanhar investimentos sem planilha. [inferido do briefing]

## Product Purpose

Baiu é um app de gestão financeira pessoal. O usuário cadastra as contas bancárias que usa para receber e pagar, e o app consolida saldos, gastos e investimentos para ajudar a pessoa a cuidar do próprio dinheiro. Sucesso: a pessoa volta ao app com frequência e melhora hábitos (gastar menos do que ganha, manter reserva, investir com constância).

## Positioning

O mecanismo próprio do Baiu é o baiacu: um mascote cujo corpo (inflado, feliz) é a leitura direta da saúde financeira do usuário. Cuidar bem do dinheiro infla o Baiu; descuido o esvazia. Um app neutro de finanças não consegue copiar isso sem copiar a marca.

## Operating Context

Uso no celular, em sessões curtas: conferir saldo consolidado, ver um gasto que caiu, checar se o mês está no azul, acompanhar investimentos. Contexto brasileiro: Real (R$), Pix, cartão de crédito com fatura, boleto, bancos como Nubank, Itaú, Inter, Bradesco, Caixa, corretoras.

## Capabilities and Constraints

- v0 (esta entrega): foco no visual, navegável no Expo Go. Contas, transações, orçamentos e investimentos são dados de demonstração locais.
- Conexão real com bancos pelo Open Finance, via Pluggy (agregador). Contas manuais continuam possíveis.
- Sem backend e sem login real na v0.
- Indefinido: fórmula final do índice de saúde financeira (a v0 usa uma regra simples e explicável). Monetização: assinatura mensal com o primeiro mês grátis, pelas lojas (preço a definir). Provedor de Open Finance escolhido: Pluggy (contrato pendente).
- Indefinido: suporte a tablet. A v0 foi desenhada para celular; o iOS está limitado a iPhone, mas o Android ainda instala em tablets.

## Brand Commitments

- Nome: Baiu. Mascote: o Baiu, um baiacu que fica feliz e infla conforme o usuário administra melhor as finanças. (confirmado pelo usuário)
- Precisa parecer confiável, moderno e recompensador, com qualidade de produto real de empresa de tecnologia, sem aparência genérica de app feito por IA. (confirmado)
- Logo, fontes e cores delegados ao design. (confirmado)

## Evidence on Hand

Nenhum dado real, logo, depoimento ou parceria existe. Todos os valores, bancos e transações da v0 são sintéticos e aparecem como demonstração. Não inventar número de usuários, certificações de segurança ou parcerias com bancos.

## Product Principles

1. Confiança antes da festa: números exatos e legíveis; o mascote recompensa, nunca esconde o dado.
2. O Baiu é um termômetro honesto: o estado do mascote sempre reflete uma regra que o usuário consegue entender.
3. Recompensa por hábito, não por consumo: celebrar reserva, constância e gastar menos do que ganha.
4. Brasileiro de verdade: R$, Pix, fatura, boleto, português natural.

## Accessibility & Inclusion

Valores com algarismos tabulares; contraste AA; o estado do mascote sempre acompanhado de texto, sem depender só de forma ou cor; respeitar Reduzir Movimento. [inferido]
