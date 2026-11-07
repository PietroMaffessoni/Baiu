# O que fazer se vazar dado

Roteiro para quando houver suspeita de incidente de segurança com dados pessoais: vazamento, acesso indevido ao Supabase, chave exposta no GitHub, conta de serviço invadida, perda de dados.

O prazo é curto: **3 dias úteis** para avisar a ANPD e as pessoas afetadas, contados de quando você souber que o incidente atingiu dados pessoais (LGPD, art. 48, e Resolução CD/ANPD nº 15/2024). Agente de pequeno porte tem o prazo em dobro, mas a política do Baiu promete 3 dias úteis: vale o que está prometido.

## Na primeira hora

1. **Pare o vazamento.** Conforme o caso:
   - chave exposta: gire a chave no painel (Supabase, Polp, RevenueCat) e cadastre a nova nos Secrets;
   - acesso indevido ao Supabase: troque a senha do banco, encerre as sessões da equipe e revise quem é membro do projeto;
   - função com falha: desligue a função no painel até corrigir.
2. **Guarde as provas.** Copie os logs (Supabase, Logs; função `bank`), prints e horários antes de qualquer limpeza.
3. **Avise o sócio** e anote a hora em que vocês souberam. É dela que o prazo conta.

## No primeiro dia

Responda, por escrito, na ficha abaixo:

- O que aconteceu e quando.
- Quais dados: só e-mail e nome? Celular? Dados de bancos (saldos, movimentos)? CPF?
- Quantas pessoas, mesmo que estimado.
- Qual o risco para elas: golpe por e-mail ou celular, fraude, exposição da vida financeira.
- O que já foi feito para conter.

## Precisa avisar?

Avise a ANPD e as pessoas se o incidente puder trazer **risco ou dano relevante**. Pela resolução, isso vale quando ele pode afetar significativamente os interesses e direitos das pessoas **e** envolve, por exemplo, dados financeiros, dados de autenticação (senhas, códigos), dados sensíveis, dados de crianças ou grande volume de pessoas.

No Baiu, quase todo vazamento de dados de bancos ou de credenciais entra nessa regra. Na dúvida, avise.

## Como avisar

**ANPD:** pelo serviço de comunicação de incidente de segurança com dados pessoais, no site da ANPD (gov.br/anpd), entrando com a conta gov.br. Informe:

- a descrição do incidente, a data em que aconteceu e a data em que você soube;
- os dados e o número de pessoas afetadas;
- os riscos e as medidas tomadas para conter e reduzir os efeitos;
- o contato do encarregado (Pietro Maffessoni, suporte.baiu@gmail.com).

Se algo ainda não for conhecido, avise assim mesmo e complete depois: há 20 dias úteis para complementar.

**Pessoas afetadas:** por e-mail, a cada uma, em linguagem simples, dizendo:

- o que aconteceu e quando;
- quais dados dela foram afetados;
- os riscos;
- o que o Baiu já fez;
- o que ela pode fazer (trocar a senha, desconfiar de mensagens pedindo código, conferir o app do banco);
- como falar com o encarregado.

Depois de avisar as pessoas, declare à ANPD que elas foram avisadas e por qual meio.

## Registro

Todo incidente, **mesmo os que não precisam ser comunicados**, fica registrado por **5 anos** (Resolução CD/ANPD nº 15/2024, art. 10). Guarde a ficha abaixo numa pasta privada. Não guarde no GitHub: o repositório é público.

```
Data e hora do incidente:
Data e hora em que soubemos:
Como soubemos:
O que aconteceu:
Dados afetados:
Número de pessoas:
Risco ou dano relevante? (sim/não e por quê):
Medidas para conter:
ANPD avisada em: (data, protocolo) ou "não precisou" e por quê
Pessoas avisadas em: (data, meio)
O que mudamos para não repetir:
```
