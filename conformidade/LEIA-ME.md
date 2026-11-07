# Conformidade do Baiu

A lista de cuidados legais do app, item por item: o que já estava pronto, o que foi feito em 06/11/2026 e o que ainda depende de vocês. Isto não substitui a revisão de um advogado, que continua pendente.

Legenda: ✅ pronto · 🔧 feito em 06/11/2026 · ⏳ falta, e depende de vocês · ➖ não se aplica ao Baiu hoje

## Textos e aceite

| Item | Situação |
| --- | --- |
| Política de privacidade e termos de uso | ✅ No app (Ajustes, Sobre) e em `docs/`. 🔧 Prazos, encarregado, incidentes, cookies, marketing, menores e mudanças de texto revistos. O texto mora em `src/content/legal.json`; `node scripts/build-legal-docs.mjs` gera os `docs/` |
| Checkbox para aceitar os termos, com registro | ✅ No cadastro, desmarcado. O servidor recusa cadastro sem aceite e grava versão e data em `consents`. 🔧 Quando um texto muda, quem já tem conta vê o resumo (tela `/novos-termos`) e aceita de novo, e cada versão nova fica registrada |
| Encarregado de dados ou canal de contato | 🔧 Encarregado nomeado: Pietro Maffessoni, canal suporte.baiu@gmail.com (assunto "Privacidade") |
| Quem é o fornecedor | ⏳ O Decreto 7.962/2013 (comércio eletrônico) pede, nos termos e na loja, o nome, o **CPF ou CNPJ** e o **endereço físico** do fornecedor. Os termos já dizem o nome. Falta decidir se entra o seu CPF e endereço, ou se vale abrir um CNPJ antes de lançar |

## Dados pessoais (LGPD)

| Item | Situação |
| --- | --- |
| Nada de rastrear antes do consentimento | ✅ Não há analytics, anúncios, identificador de publicidade nem pixel. O RevenueCat só liga depois que a conta existe. O manifesto do iPhone declara "sem rastreamento" |
| Banner de cookies com botão de recusar | ➖ O app não usa cookies. As páginas de `docs/` ficam no GitHub, que cuida dos cookies dele. Se um dia houver site próprio com analytics, aí precisa do banner, com "Recusar" do mesmo tamanho de "Aceitar" |
| Consentimento separado para marketing | ➖ O Baiu não manda propaganda. 🔧 A política promete que, se um dia mandar, vai pedir uma autorização à parte, desmarcada. Só crie essa caixa junto com o envio, nunca antes |
| Link de descadastro em todo e-mail | ➖ Os três e-mails (código, recuperação, senha alterada) são da conta e não precisam. Todo e-mail de novidades precisará ter |
| Coletar só o necessário | ✅ CPF não é guardado; finanças ficam no aparelho; "como conheceu" é opcional. ⏳ O **celular é obrigatório** e não tem uso concreto ("se precisar"). É o ponto mais fraco na regra da necessidade: decida entre torná-lo opcional ou tirá-lo |
| Prazo de cada dado | 🔧 A política lista o prazo de cada um. 🔧 Os registros de acesso (data, hora e IP) agora são apagados depois de 6 meses por uma tarefa diária (migração `20261106120000`) |
| Pedir acesso e exclusão | ✅ Corrigir em Minha conta, exportar em CSV, excluir a conta no app (desconecta bancos e apaga o RevenueCat) e por e-mail (`docs/excluir-conta.md`). 🔧 A política e Minha conta dizem que dá para pedir a cópia de tudo do servidor, em até 15 dias |
| Vazou dado com risco: avisar a ANPD em até 3 dias úteis | 🔧 Prometido na política, com o roteiro em [incidentes.md](incidentes.md). ⏳ Leiam o roteiro antes de lançar |
| Dados de crianças só com consentimento dos pais | ✅ O app é só para 18+: o cadastro pede a confirmação, o servidor recusa sem ela e a loja está como 18+. 🔧 A política diz que conta de menor é excluída e como os pais avisam |
| Contrato com quem processa os dados | ⏳ Veja "Operadores" abaixo |

## Compras e assinatura (Código de Defesa do Consumidor)

| Item | Situação |
| --- | --- |
| 7 dias de arrependimento | ✅ Nos termos e no atalho "Pedir reembolso". 🔧 Os termos agora dizem que, se a loja recusar, **o Baiu devolve** (pela loja ou por Pix). ⏳ Isso é obrigação sua: no Google Play dá para reembolsar pelo Play Console; na Apple, só a Apple reembolsa, então o caminho é Pix |
| Cancelar fácil pelo mesmo lugar onde assinou | ✅ Ajustes, Assinatura, "Cancelar assinatura" abre a página da loja onde a pessoa assinou |
| Avisar a renovação automática | ✅ Dito antes de assinar, junto do botão, e aviso 2 dias antes do fim da semana grátis |
| Nada de taxa escondida | ✅ O preço vem da loja. 🔧 Os termos dizem que o preço mostrado é o total, sem taxa de adesão. 🔧 Corrigido: com o plano anual escolhido (sem semana grátis), a tela ainda dizia "Sua primeira semana é por nossa conta" e o preço do mensal |
| Nada de cronômetro falso | ✅ Não há. O contador de juros do Começar não é oferta: corre com o dado real do semestre (FecomercioSP) |
| Nada de avaliações falsas | ✅ `RELATOS` está vazio de propósito: só entram relatos reais, com autorização por escrito |
| Sem promessas que não cumprimos | ✅ Conferido nas fichas das lojas e no app: açaí, contas repetidas, dúvidas sobre economia e reserva e lembretes existem no código. 🔧 "Organize seu dinheiro sem digitar nada" virou "Seu dinheiro organizado num lugar só". 🔧 A política prometia avisar mudanças antes de valer, e não havia como: agora há |
| Responder o consumidor | 🔧 Os termos e o suporte dizem "respondemos em até 5 dias" (Decreto 7.962/2013, art. 4º). ⏳ Cumpram esse prazo no e-mail |

## Marcas, licenças e acessibilidade

| Item | Situação |
| --- | --- |
| Licença de imagem, fonte e código | ✅ Ícones: SF Symbols só no iPhone (permitido pela Apple) e Material Symbols no Android (Apache 2.0). Fonte Zen Maru Gothic (OFL 1.1). Mascote e ícone do app feitos por vocês. Nenhuma biblioteca do app usa GPL ou AGPL. 🔧 Ajustes, Sobre, "Licenças de código aberto" mostra o aviso de cada biblioteca, como as licenças MIT, BSD e Apache pedem. Depois de trocar dependências, rode `node scripts/build-licenses.mjs` |
| Logo de cliente ou banco sem autorização | ✅ Os bancos aparecem com iniciais e cor próxima, nunca com a marca. Não há logo de cliente |
| Acessibilidade: contraste, texto e navegação | ✅ Botões e campos têm nome e papel para o leitor de tela; o texto acompanha o tamanho de letra do aparelho (só os números grandes e o teclado numérico ficam fixos). 🔧 Dois tons (`ink3` e `vermilion`) ficavam abaixo de 4,5:1 sobre os cartões claros e foram ajustados. ⏳ Testem uma vez com VoiceOver e TalkBack num aparelho de verdade |
| Formulários de privacidade das lojas | 🔧 Faltava declarar o "como conheceu o Baiu". Acrescentado em `store/` e no manifesto do iPhone (`app.json`) |

## Operadores (contrato com quem processa os dados)

| Quem | O que faz | Situação |
| --- | --- | --- |
| Supabase | Servidor, login, funções | ⏳ O DPA vale ao aceitar os termos: baixe e guarde a versão atual em supabase.com/legal/dpa |
| RevenueCat | Confere a assinatura | ⏳ O DPA faz parte dos termos: baixe e guarde a versão atual em revenuecat.com/dpa |
| Polp | Ponte com o Open Finance | ⏳ Peça por escrito o contrato com as cláusulas de proteção de dados (uso só para o Baiu, segurança, aviso de incidente, prazos de 60 e 90 dias para apagar). Pergunte também em quanto tempo ela apaga os dados de quem cancela a autorização, para pôr na política. Depois, preencha o formulário de conformidade no painel |
| Celcoin | Recebe os dados dos bancos | ➖ Atua com os termos e a norma de privacidade dela, mostrados à pessoa ao conectar. O contrato é com a Polp |
| Envio de e-mails (SMTP) | Códigos e senha | ⏳ Ainda não escolhido. Use um provedor transacional com DPA (Resend, Brevo ou parecido). O Gmail pessoal não tem DPA e guarda cada código enviado na pasta Enviados, o que não bate com o prazo de 30 dias da política |
| Apple e Google | Cobram a assinatura | ➖ São controladores independentes, pelos contratos de desenvolvedor |
| GitHub | Páginas de ajuda e volta do Open Finance | ➖ Termos do GitHub; citado na política |

## Para o advogado olhar

- Transferência internacional (Supabase e RevenueCat são dos EUA): confirmar a base usada na política (art. 33 da LGPD) diante da Resolução CD/ANPD nº 19/2024, que trata das cláusulas-padrão.
- Responsabilidade de quem vende como pessoa física, com CPF, e se vale abrir CNPJ antes de lançar (também por causa do Marco Civil, art. 15, e do endereço público que as lojas pedem).
- A promessa de devolver o valor por Pix quando a loja recusar.
- Os textos sobre a Celcoin e a Polp.

## Antes de cada publicação

- [ ] Mudou um texto legal? Troque `TERMS_VERSION` ou `PRIVACY_VERSION` em `src/lib/auth/types.ts`, escreva o resumo em `changes` no `src/content/legal.json` e gere os `docs/`.
- [ ] Trocou dependências? `node scripts/build-licenses.mjs`.
- [ ] Coletou um dado novo? Atualize a política, os formulários das lojas e o manifesto em `app.json`.
- [ ] Em `supabase/conferencia.sql`, os itens 44 e 45 (registros de acesso) estão com ✅.
