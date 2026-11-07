// Caminho do primeiro uso: perguntas, telas do app, a média que escapa, a conta da vida inteira, os dados, o objetivo e o cadastro.
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
  await step('02 começar pergunta para quem é', () => btn('Começar', { wait: 1200 }), ['Para quem é o Baiu?', 'Só para mim', 'Para mim e minha casa'], ['Assim as contas']);
  await step('03 sem escolher, continuar fica desligado', async () => {
    if (!(await page.getByRole('button', { name: 'Continuar', exact: true }).isDisabled())) return false;
  }, ['Para quem é o Baiu?']);
  await step('04 escolher e continuar mostra as contas', async () => {
    await radio('Para mim e minha casa');
    await btn('Continuar', { wait: 1200 });
  }, ['Todas as suas contas num lugar só', 'Saldo nas contas'], ['Open Finance', 'Exemplo ilustrativo']);
  await step('05 para onde vai cada real', () => btn('Continuar', { wait: 1600 }), [
    'Veja para onde vai cada real', 'Gastos de outubro', 'Delivery no dobro do seu normal',
  ]);
  await step('06 como conheceu', () => btn('Continuar', { wait: 1200 }), ['Como você conheceu o Baiu?', 'Instagram', 'Alguém me indicou'], ['Ajuda a gente']);
  await step('07 a resposta fica guardada; a média que escapa de cada casa', async () => {
    await radio('Alguém me indicou');
    await btn('Continuar', { wait: 1800 });
    if ((await origem()) !== 'indicacao') return false;
  }, ['Todo mês, escapam em média de cada casa brasileira', 'R$ 1.186', 'só em juros', '14,64%'], ['FecomercioSP']);
  await step('08 idade, sem texto de rodapé', () => btn('Continuar', { wait: 1200 }), ['Quantos anos você tem?', '30'], ['não saem deste aparelho']);
  await step('09 a conta da vida inteira', () => btn('Continuar', { wait: 1800 }), [
    'Se for assim com você, até os 77 anos vão escapar da sua casa', 'R$ 668.904', 'São R$ 14.232 por ano, durante 47 anos',
  ], ['IBGE']);
  await step('10 em coisas', () => btn('Continuar', { wait: 1800 }), [
    'R$ 668.904 é o mesmo que', '55', 'iPhones 18 Pro', '9', 'carros zero', '1.043', 'metros de notas de R$ 100, uma atrás da outra',
  ], ['salários mínimos', 'cesta básica', 'Petrobras']);
  await step('11 na poupança', () => btn('Continuar', { wait: 1800 }), ['guardado na poupança', 'Só de rendimento'], ['Lei 12.703/2012']);
  await step('12 voltar refaz a conta com outra idade', async () => {
    await btn('Voltar', { wait: 800 });
    await btn('Voltar', { wait: 800 });
    await btn('Voltar', { wait: 800 });
    await slide('Sua idade', 'ArrowRight', 10);
    await btn('Continuar', { wait: 1800 });
  }, ['até os 77 anos', 'São R$ 14.232 por ano, durante 37 anos', 'R$ 526.584']);
  await step('13 você não está sozinho, sem fonte na tela', async () => {
    await btn('Continuar', { wait: 1500 });
    await btn('Continuar', { wait: 1500 });
    await btn('Continuar', { wait: 1500 });
  }, ['Você não está sozinho', '48%', '1 em 3'], ['CNDL e SPC Brasil', 'Fonte:']);
  await step('14 não é culpa sua', () => btn('Continuar', { wait: 1200 }), ['E não é culpa sua', '2x'], ['Prelec']);
  await step('15 o contador de juros corre', async () => {
    await btn('Continuar', { wait: 1500 });
    const a = await page.getByText(/^R\$/).first().textContent();
    await W(1200);
    const b = await page.getByText(/^R\$/).first().textContent();
    if (a === b) return false;
  }, ['as famílias brasileiras já pagaram', 'em juros', 'R$ 39,53 por dia de cada casa brasileira'], ['FecomercioSP']);
  await step('16 quem enriquece, e depois direto ao objetivo', async () => {
    await btn('Continuar', { wait: 1200 });
  }, ['Quem enriquece sabe para onde vai o dinheiro', '62%'], ['O Milionário Mora ao Lado']);
  await step('17 o objetivo usa a quantia inteira', async () => {
    await btn('Continuar', { wait: 1200 });
    await radio('Uma viagem');
    await W(600);
  }, ['O que você faria com esse dinheiro?', 'Guardando esses R$ 1.186 por mês na poupança', 'R$ 14.630', 'para a sua viagem', 'Em 5 anos, R$ 82.747'], ['metade', 'acende a luz', 'Simulação']);
  await step('18 o fim leva ao cadastro', () => btn('Continuar', { wait: 1500 }), [
    'Comece hoje a ver para onde vai o seu dinheiro', 'Em média, escapam R$ 1.186 por mês de cada casa brasileira', 'Criar minha conta', 'Já tenho conta',
  ], ['Pular']);
  await step('19 criar minha conta abre o cadastro', () => btn('Criar minha conta', { wait: 1200 }), ['Nome completo']);
  await step('20 pular vai direto ao fim', async () => {
    await go('/comecar');
    await btn('Pular', { wait: 1200 });
  }, ['Criar minha conta', 'do bolso de cada adulto brasileiro', 'R$ 557'], ['Para quem é o Baiu?']);
  await step('21 o cadastro leva a origem e depois a esquece', async () => {
    await signup('Ana Souza', 'ana.souza@gmail.com', '11996421873');
    if ((await origem()) !== null) return false;
  });
  await step('22 nos Ajustes, rever começa pelas boas-vindas', async () => {
    await go('/ajustes');
    await btn('Rever a apresentação', { wait: 1500 });
  }, ['Cuide do seu dinheiro.', 'Começar', 'Já tem uma conta?', 'Explorar com dados de exemplo'], ['Para quem é o Baiu?']);
  await step('23 começar leva às perguntas; voltar devolve às boas-vindas', async () => {
    await btn('Começar', { wait: 1200 });
    await btn('Fechar', { wait: 1000 });
  }, ['Cuide do seu dinheiro.', 'Começar'], ['Para quem é o Baiu?']);
  await step('24 revendo, o fim só fecha', async () => {
    await btn('Começar', { wait: 1200 });
    await btn('Pular', { wait: 1200 });
  }, ['O Baiu está com você', 'Fechar'], ['Criar minha conta']);
  await step('25 fechar volta aos Ajustes', () => btn('Fechar', { wait: 1200 }), ['Rever a apresentação']);
  await step('26 o fechar das boas-vindas também volta aos Ajustes', async () => {
    await btn('Rever a apresentação', { wait: 1500 });
    await btn('Fechar', { wait: 1200 });
  }, ['Rever a apresentação'], ['Cuide do seu dinheiro.']);
};
module.exports.pace = { go: 1500, btn: 700 };
