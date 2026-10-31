// Apresentação do primeiro uso: dados diretos sobre controle do dinheiro, com fonte, a conta "E no seu bolso?" e o fim.
module.exports = async ({ page, step, go, btn, W }) => {
  await go('/');
  await step('01 abre na apresentação, não nas boas-vindas', async () => {}, [
    '48%', 'dos brasileiros não controlam o próprio dinheiro', 'confia só na memória', 'Fonte: CNDL e SPC Brasil', 'Pular', 'Continuar',
  ], ['Criar conta']);
  await step('02 o que fazem os mais ricos', () => btn('Continuar', { wait: 1600 }), [
    '62%', 'dos milionários sabem quanto a família gasta', 'só 35% sabem', 'classes A e B', 'O Milionário Mora ao Lado', 'Anbima e Datafolha',
  ]);
  await step('03 assinaturas', () => btn('Continuar', { wait: 1600 }), ['R$ 1.416', 'por ano em assinaturas', '1 em cada 3', 'Fonte: Bango']);
  await step('04 voltar funciona', () => btn('Voltar', { wait: 1600 }), ['62%']);
  await step('05 "E no seu bolso?" com R$ 100 por mês', async () => {
    await btn('Continuar', { wait: 1600 });
    await btn('Continuar', { wait: 1200 });
  }, ['E no seu bolso?', 'em 10 anos', '12.000']);
  await step('06 trocar o valor refaz a conta', async () => {
    await page.getByRole('radio', { name: 'R$ 300', exact: true }).click();
    await W(600);
  }, ['36.000', 'É o que R$ 300 por mês somam em 10 anos']);
  await step('07 no fim, o Baiu acende a luz', () => btn('Continuar', { wait: 1500 }), [
    'O Baiu acende a luz', 'Conecte até 3 bancos', 'Começar',
  ], ['Pular']);
  await step('08 começar leva às boas-vindas', () => btn('Começar', { wait: 1500 }), ['Criar conta', 'Já tenho conta', 'Explorar com dados de exemplo']);
  await step('09 a apresentação não volta depois de recarregar', () => go('/'), ['Criar conta'], ['dos brasileiros não controlam']);
  await step('10 pular também marca como vista', async () => {
    await page.evaluate(() => localStorage.removeItem('baiu:apresentacao-vista'));
    await go('/');
    await btn('Pular', { wait: 1200 });
    await go('/');
  }, ['Criar conta'], ['dos brasileiros não controlam']);
};
module.exports.context = { intro: true };
module.exports.pace = { go: 1500, btn: 700 };
