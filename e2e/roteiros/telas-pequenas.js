// Telas de celulares pequenos e grandes: a boas-vindas e a assinatura cabem sem esconder os botões.
const { newPhone, tools } = require('../lib');

const SIZES = [
  [360, 640],
  [375, 667],
  [393, 852],
  [430, 932],
];

module.exports = async (browser) => {
  const results = [];
  for (const [width, height] of SIZES) {
    const { ctx, page, errors } = await newPhone(browser, { viewport: { width, height } });
    const t = tools(page, `telas-${width}`);
    await t.step(`${width}×${height} boas-vindas mostra os três caminhos sem rolar`, async () => {
      await t.go('/');
      for (const name of ['Criar conta', 'Já tenho conta', 'Explorar com dados de exemplo']) {
        const box = await page.getByRole('button', { name, exact: true }).first().boundingBox();
        if (!box || box.y + box.height > height) throw new Error(`"${name}" fica fora da tela (y=${box && Math.round(box.y + box.height)})`);
      }
    });
    await t.step(`${width}×${height} assinatura: o botão de assinar aparece`, async () => {
      await t.signup('Teste Tela', `tela.${width}@gmail.com`, '11996421873', { subscribe: false });
      const b = page.getByRole('button', { name: 'Começar meu mês grátis', exact: true }).first();
      await b.scrollIntoViewIfNeeded();
      const box = await b.boundingBox();
      if (!box || box.y + box.height > height || box.y < 0) throw new Error('botão fora da tela');
      if ((await page.evaluate(() => document.documentElement.scrollWidth)) > width + 1) throw new Error('a página rola para o lado');
    });
    await ctx.close();
    results.push(...t.results);
    errors.filter((e) => e.startsWith('PAGEERROR')).forEach((e) => results.push('ERRO  ' + e));
  }
  return results;
};
module.exports.custom = true;
