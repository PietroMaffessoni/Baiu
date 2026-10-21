// O Baiu assistente: avisos e respostas prontas no exemplo, consentimento para a IA e a IA de teste.
module.exports = async ({ page, step, go, btn, tap, field, text, W, signup, signOut }) => {
  const ask = async (q, wait = 1600) => {
    await field('Mensagem para o Baiu').fill(q);
    await W(150);
    await btn('Enviar', { wait });
  };

  // ---------- modo exemplo ----------
  await go('/');
  await step('01 boas-vindas apresenta o assistente', async () => {}, ['O Baiu avisa quando um gasto foge do normal']);
  await step('02 no exemplo, o Baiu fala no início', () => btn('Explorar com dados de exemplo', { wait: 4500 }), ['O Baiu notou', 'Conversar sobre isso', 'Dispensar']);
  await step('03 abre a conversa com os avisos', () => btn('Conversar sobre isso', { wait: 1500 }), [
    'Respostas prontas do modo exemplo', 'Eu sou o Baiu', 'No modo exemplo o Baiu usa respostas prontas', 'a mais com açaí do que no mês passado inteiro',
    'Reconheci que conta de gás se repete', 'Criar lembrete', 'Como posso gastar menos com açaí?',
  ], ['Ativar a conversa com IA']);
  await step('04 sugestão: onde economizar', () => btn('Onde posso economizar?', { wait: 1500 }), ['Onde mais saiu dinheiro este mês', 'O que eu faria', 'Resposta pronta, sem IA']);
  await step('05 pergunta digitada: reserva', () => ask('Como montar minha reserva?'), ['Sua reserva tem R$', 'Tesouro Selic']);
  await step('06 pergunta fora do assunto', () => ask('qual a capital da França?'), ['Essa eu não sei responder com as respostas prontas']);
  await step('07 ação do aviso: pergunta sugerida', async () => {
    await page.getByRole('button', { name: 'Como posso gastar menos com açaí?' }).first().click();
    await W(1500);
  }, ['Defina um teto']);
  await step('08 criar lembrete a partir da conta que se repete', async () => {
    await page.getByRole('button', { name: 'Criar lembrete' }).first().click();
    await W(1200);
  }, ['Quanto vai pagar?']);
  await step('09 de volta ao início: avisos já vistos', async () => {
    await page.goBack();
    await W(800);
    await page.goBack();
    await W(1200);
  }, ['Conversar com o Baiu'], ['O Baiu notou', 'Dispensar']);
  await step('10 ocultar valores esconde os reais na conversa', async () => {
    await btn('Ocultar valores');
    await tap('Conversar com o Baiu', { wait: 1300 });
  }, ['R$ ••••'], ['R$ 9.800,00', 'R$ 51,40']);

  // ---------- conta real (servidor falso) ----------
  // o modo exemplo não sobrevive a recarregar a página: volta à tela inicial
  await go('/');
  await signup('Carla Mendes', 'carla.mendes@gmail.com', '11996421873');
  await step('11 conta nova: o Baiu se apresenta no início', async () => {}, ['Oi, Carla! Eu sou o Baiu.', 'Conversar com o Baiu']);
  await step('12 conversa pede consentimento para a IA', () => tap('Conversar com o Baiu', { nth: -1, wait: 1300 }), [
    'Oi, Carla! Eu sou o Baiu.', 'Conversar com inteligência artificial', 'Anthropic', 'Não vão seu nome, e-mail, celular', 'Ativar a conversa com IA', 'Agora não, só respostas prontas',
  ]);
  await step('13 mostra o resumo que seria enviado', () => tap('Ver o resumo que seria enviado agora'), ['Saldos somados', 'Este mês: entrou', 'Fôlego']);
  await step('14 "agora não": respostas prontas', async () => {
    await btn('Agora não, só respostas prontas');
    await ask('Onde posso economizar?');
  }, ['Você está usando só as respostas prontas', 'Ainda não tenho números seus', 'Resposta pronta, sem IA'], ['Ativar a conversa com IA']);
  await step('15 ativa a conversa com IA', async () => {
    await tap('Conhecer a conversa com IA');
    await btn('Ativar a conversa com IA', { wait: 1500 });
  }, ['Conversa com IA'], ['Ativar a conversa com IA', 'Você está usando só as respostas prontas']);
  await step('16 pergunta vai para a IA com o resumo', () => ask('Quanto eu gastei este mês?', 2200), ['Resposta da IA de teste para "Quanto eu gastei este mês?"', 'Recebi o resumo']);
  await step('17 a conversa continua depois de recarregar', () => go('/baiu'), ['Quanto eu gastei este mês?', 'Resposta da IA de teste', 'Conversa com IA']);
  await step('18 ajustes mostram o assistente', () => go('/ajustes'), [
    'Assistente', 'Conversar com o Baiu', 'Avisos de gastos', 'Conversa com IA', 'Usar meus números', 'O que o Baiu envia', 'cada pergunta leva um resumo dos números',
  ]);
  await step('19 sem os números, vai só a pergunta', async () => {
    await btn('Usar meus números', { role: 'switch', wait: 400 });
    await go('/baiu');
    await ask('E agora?', 2200);
  }, ['Recebi só a pergunta, sem os seus números']);
  await step('20 "O que o Baiu envia" explica o resumo', async () => {
    await go('/ajustes');
    await tap('O que o Baiu envia', { wait: 1200 });
  }, ['O que o Baiu envia para a IA', 'Você desligou o envio dos números', 'Nunca vão seu nome']);
  await step('21 desligar a IA volta às respostas prontas', async () => {
    await go('/ajustes');
    await btn('Conversa com IA', { role: 'switch', wait: 800 });
    await go('/baiu');
    await ask('Minhas assinaturas');
  }, ['Conversar com inteligência artificial', 'Ainda não tenho números seus']);
  await step('22 o servidor registrou a revogação', async () => {
    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('baiu:fake-ai') || '{}'));
    if (db.consented !== false) throw new Error('consentimento ainda ativo: ' + JSON.stringify(db));
  });
  await step('23 apagar a conversa', () => btn('Apagar conversa', { wait: 800 }), ['Eu sou o Baiu'], ['Quanto eu gastei este mês?', 'Ainda não tenho números seus']);
  await step('24 lembrete preenchido pelo Baiu', async () => {
    await go('/vencimento/novo?title=Conta%20de%20g%C3%A1s&amount=8990&category=contas&day=9');
    if (!(await text()).replace(/ \| /g, '').includes('89,90')) throw new Error('valor não veio preenchido');
  });
  await step('25 continua com o nome sugerido', async () => {
    await btn('Continuar', { wait: 800 });
    const values = await page.locator('input, textarea').evaluateAll((els) => els.map((e) => e.value));
    if (!values.includes('Conta de gás')) throw new Error('campos: ' + JSON.stringify(values));
  });

  // ---------- cada conta tem a sua conversa ----------
  await step('26 outra conta não vê a conversa da anterior', async () => {
    await go('/baiu');
    await ask('segredo da Carla');
    await signOut();
    await signup('Davi Rocha', 'davi.rocha@outlook.com', '21997318264');
    await go('/baiu');
  }, ['Oi, Davi!'], ['segredo da Carla']);
};
module.exports.pace = { go: 1300, btn: 600 };
