// Caminho do primeiro uso: perguntas, telas do app, a conta do que escapa na vida, dados com fonte, o objetivo e o cadastro.
module.exports = async ({ page, step, go, btn, radio, W, signup }) => {
  const origem = () => page.evaluate(() => localStorage.getItem('baiu:origem'));
  const slide = async (name, key, times) => {
    const s = page.getByRole('slider', { name, exact: true });
    await s.focus();
    for (let i = 0; i < times; i++) await s.press(key);
    await W(400);
  };

  await go('/');
  await step('01 boas-vindas: começar grande, entrar pequeno', async () => {}, ['Começar', 'Já tem uma conta?', 'Entrar']);
  await step('02 começar pergunta para quem é', () => btn('Começar', { wait: 1200 }), ['Para quem é o Baiu?', 'Só para mim', 'Para mim e minha casa']);
  await step('03 sem escolher, continuar fica desligado', async () => {
    if (!(await page.getByRole('button', { name: 'Continuar', exact: true }).isDisabled())) return false;
  }, ['Para quem é o Baiu?']);
  await step('04 escolher e continuar mostra as contas', async () => {
    await radio('Para mim e minha casa');
    await btn('Continuar', { wait: 1200 });
  }, ['Todas as suas contas num lugar só', 'Saldo nas contas', 'Exemplo ilustrativo']);
  await step('05 os avisos do Baiu', () => btn('Continuar', { wait: 1400 }), ['O Baiu avisa antes de o dinheiro escapar', 'Delivery fora do normal', 'Fôlego 72']);
  await step('06 como conheceu', () => btn('Continuar', { wait: 1200 }), ['Como você conheceu o Baiu?', 'Instagram', 'Alguém me indicou']);
  await step('07 a resposta fica guardada para o cadastro', async () => {
    await radio('Alguém me indicou');
    await btn('Continuar', { wait: 1200 });
    if ((await origem()) !== 'indicacao') return false;
  }, ['Quanto escapa da sua casa por mês sem você perceber?', 'R$ 300', 'por mês', 'Bango']);
  await step('08 a régua muda o valor', () => slide('Quanto escapa por mês', 'ArrowRight', 5), ['R$ 400']);
  await step('09 idade', async () => {
    await btn('Continuar', { wait: 1200 });
  }, ['Quantos anos você tem?', '30', 'não saem deste aparelho']);
  await step('10 a conta da vida inteira', () => btn('Continuar', { wait: 1800 }), [
    'até os 77 anos vão escapar da sua casa', 'R$ 225.600', 'São R$ 4.800 por ano, durante 47 anos', 'IBGE',
  ]);
  await step('11 em coisas', () => btn('Continuar', { wait: 1800 }), [
    '139', 'salários mínimos inteiros', '246', 'meses de cesta básica', '159', 'Decreto 12.797/2025', 'DIEESE',
  ]);
  await step('12 na poupança', () => btn('Continuar', { wait: 1800 }), ['guardado na poupança', 'Só de rendimento', 'Lei 12.703/2012']);
  await step('13 voltar refaz a conta com outra idade', async () => {
    await btn('Voltar', { wait: 800 });
    await btn('Voltar', { wait: 800 });
    await btn('Voltar', { wait: 800 });
    await slide('Sua idade', 'ArrowRight', 10);
    await btn('Continuar', { wait: 1800 });
  }, ['até os 77 anos', 'São R$ 4.800 por ano, durante 37 anos', 'R$ 177.600']);
  await step('14 você não está sozinho', async () => {
    await btn('Continuar', { wait: 1500 });
    await btn('Continuar', { wait: 1500 });
    await btn('Continuar', { wait: 1500 });
  }, ['Você não está sozinho', '48%', '1 em 3', 'CNDL e SPC Brasil']);
  await step('15 não é culpa sua', () => btn('Continuar', { wait: 1200 }), ['E não é culpa sua', '2x', 'Prelec']);
  await step('16 o contador de juros corre', async () => {
    await btn('Continuar', { wait: 1500 });
    const a = await page.getByText(/^R\$/).first().textContent();
    await W(1200);
    const b = await page.getByText(/^R\$/).first().textContent();
    if (a === b) return false;
  }, ['as famílias brasileiras já pagaram', 'em juros', 'FecomercioSP']);
  await step('17 quem enriquece', () => btn('Continuar', { wait: 1200 }), ['Quem enriquece sabe para onde vai o dinheiro', '62%', 'O Milionário Mora ao Lado']);
  await step('18 como o Baiu ajuda', () => btn('Continuar', { wait: 1500 }), ['O Baiu acende a luz', 'Conecte até 3 bancos']);
  await step('19 o objetivo vira uma simulação', async () => {
    await btn('Continuar', { wait: 1200 });
    await radio('Uma viagem');
    await W(600);
  }, ['O que você faria com esse dinheiro?', 'em 1 ano você junta', 'R$ 2.467', 'para a sua viagem', 'Simulação']);
  await step('20 o fim leva ao cadastro', () => btn('Continuar', { wait: 1500 }), [
    'Comece hoje a ver para onde vai o seu dinheiro', 'Cada mês que passa, escapam R$ 400 da sua casa', 'Criar minha conta', 'Já tenho conta',
  ], ['Pular']);
  await step('21 criar minha conta abre o cadastro', () => btn('Criar minha conta', { wait: 1200 }), ['Nome completo']);
  await step('22 pular vai direto ao fim', async () => {
    await go('/comecar');
    await btn('Pular', { wait: 1200 });
  }, ['Criar minha conta'], ['Para quem é o Baiu?']);
  await step('23 o cadastro leva a origem e depois a esquece', async () => {
    await signup('Ana Souza', 'ana.souza@gmail.com', '11996421873');
    if ((await origem()) !== null) return false;
  });
  await step('24 nos Ajustes dá para rever', async () => {
    await go('/ajustes');
    await btn('Rever a apresentação', { wait: 1200 });
  }, ['Para quem é o Baiu?']);
  await step('25 revendo, o fim só fecha', async () => {
    await btn('Pular', { wait: 1200 });
  }, ['O Baiu está com você', 'Fechar'], ['Criar minha conta']);
  await step('26 fechar volta aos Ajustes', () => btn('Fechar', { wait: 1200 }), ['Rever a apresentação']);
};
module.exports.pace = { go: 1500, btn: 700 };
