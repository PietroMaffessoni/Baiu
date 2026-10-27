// O Baiu assistente: avisos e respostas calculadas no aparelho. A IA está desligada nesta versão (AI_ENABLED):
// nada de aceite da IA, nada enviado para fora.
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
    'Seu assistente financeiro', 'Eu sou o Baiu', 'a mais com açaí do que no mês passado inteiro',
    'Reconheci que conta de gás se repete', 'Criar lembrete', 'Como posso gastar menos com açaí?',
  ], ['Ativar a conversa com IA', 'inteligência artificial']);
  await step('04 sugestão: onde economizar', () => btn('Onde posso economizar?', { wait: 1500 }), ['Onde mais saiu dinheiro este mês', 'O que eu faria'], ['sem IA']);
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
  await step('12 conversa sem IA: nada de aceite nem de envio', () => tap('Conversar com o Baiu', { nth: -1, wait: 1300 }), [
    'Oi, Carla! Eu sou o Baiu.', 'Seu assistente financeiro',
  ], ['Conversar com inteligência artificial', 'Anthropic', 'Ativar a conversa com IA']);
  await step('13 responde com os números do aparelho', () => ask('Onde posso economizar?'), ['Ainda não tenho números seus'], ['sem IA']);
  await step('14 nada foi para a IA', async () => {
    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('baiu:fake-ai') || '{"count":0}'));
    if (db.consented || db.count) throw new Error('a IA foi usada: ' + JSON.stringify(db));
  });
  await step('15 a conversa continua depois de recarregar', () => go('/baiu'), ['Onde posso economizar?', 'Ainda não tenho números seus']);
  await step('16 ajustes mostram o assistente, sem as opções da IA', () => go('/ajustes'), [
    'Assistente', 'Conversar com o Baiu', 'Avisos de gastos',
  ], ['Conversa com IA', 'Usar meus números', 'O que o Baiu envia', 'cada pergunta leva um resumo']);
  await step('17 apagar a conversa', async () => {
    await go('/baiu');
    await btn('Apagar conversa', { wait: 800 });
  }, ['Eu sou o Baiu'], ['Ainda não tenho números seus']);
  await step('18 lembrete preenchido pelo Baiu', async () => {
    await go('/vencimento/novo?title=Conta%20de%20g%C3%A1s&amount=8990&category=contas&day=9');
    if (!(await text()).replace(/ \| /g, '').includes('89,90')) throw new Error('valor não veio preenchido');
  });
  await step('19 continua com o nome sugerido', async () => {
    await btn('Continuar', { wait: 800 });
    const values = await page.locator('input, textarea').evaluateAll((els) => els.map((e) => e.value));
    if (!values.includes('Conta de gás')) throw new Error('campos: ' + JSON.stringify(values));
  });

  // ---------- cada conta tem a sua conversa ----------
  await step('20 outra conta não vê a conversa da anterior', async () => {
    await go('/baiu');
    await ask('segredo da Carla');
    await signOut();
    await signup('Davi Rocha', 'davi.rocha@outlook.com', '21997318264');
    await go('/baiu');
  }, ['Oi, Davi!'], ['segredo da Carla']);
};
module.exports.pace = { go: 1300, btn: 600 };
