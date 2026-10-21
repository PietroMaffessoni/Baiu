// Personalização do Baiu: cor por conta, enfeites das datas e prévia.
const SANTA_RED = '#D9353B';
const WITCH_HAT = '#3D2D5E';

module.exports = async ({ page, step, go, btn, tap, field, W, signup, signOut, PASSWORD }) => {
  const radio = (name) => page.getByRole('radio', { name, exact: true });
  const checked = async (name) => (await radio(name).getAttribute('aria-checked')) === 'true';
  const html = () => page.evaluate(() => document.body.innerHTML);
  const toggleSeasons = () => btn('Enfeitar nas datas', { role: 'switch', wait: 400 });

  await signup('Ana Souza', 'ana.souza@gmail.com', '21991234560');
  await step('01 ajustes tem "Personalizar o Baiu"', () => go('/ajustes'), ['Personalizar o Baiu']);
  await step('02 abre a personalização com Âmbar marcado', async () => {
    await tap('Personalizar o Baiu', { wait: 1200 });
    return (await checked('Âmbar')) && !(await checked('Turquesa'));
  });
  await step('03 escolhe Turquesa', async () => {
    await radio('Turquesa').click();
    await W(400);
    return (await checked('Turquesa')) && !(await checked('Âmbar'));
  });
  await step('04 a cor fica gravada depois de recarregar', async () => {
    await go('/personalizar');
    return checked('Turquesa');
  });
  await step('05 a tela inicial usa a cor escolhida', async () => {
    await go('/');
    return (await html()).includes('-turquesa-');
  });
  await step('06 prévia do Natal mostra o gorro', async () => {
    await go('/personalizar');
    await page.getByRole('button', { name: /^Natal,/ }).click();
    await W(500);
    return (await html()).includes(SANTA_RED);
  }, ['Prévia: Natal']);
  await step('07 voltar ao normal tira o gorro', async () => {
    await tap('Voltar ao normal');
    return !(await html()).includes(SANTA_RED);
  }, [], ['Prévia: Natal']);
  await step('08 desliga os enfeites e a escolha fica gravada', async () => {
    await toggleSeasons();
    await go('/personalizar');
    return (await page.getByRole('switch', { name: 'Enfeitar nas datas' }).isChecked()) === false;
  });

  // relógio no Natal
  await step('09 com enfeites desligados, o Natal não aparece', async () => {
    await page.clock.setFixedTime(new Date(2026, 11, 10, 10));
    await go('/');
    return !(await html()).includes(SANTA_RED);
  });
  await step('10 com enfeites ligados, o Baiu usa o gorro no Natal', async () => {
    await go('/personalizar');
    await toggleSeasons();
    await go('/');
    return (await html()).includes(SANTA_RED);
  });
  await step('11 a personalização avisa a data de hoje', () => go('/personalizar'), ['Hoje o Baiu está enfeitado para o Natal.']);
  await step('12 no Halloween, chapéu de bruxa', async () => {
    await page.clock.setFixedTime(new Date(2026, 9, 31, 10));
    await go('/');
    return (await html()).includes(WITCH_HAT);
  });
  await step('13 fora das datas, sem enfeite', async () => {
    await page.clock.setFixedTime(new Date(2026, 10, 10, 10));
    await go('/');
    const h = await html();
    return !h.includes(SANTA_RED) && !h.includes(WITCH_HAT);
  });

  // cada conta tem a sua cor
  await step('14 outra conta começa com a cor padrão', async () => {
    await signOut();
    await signup('Bruno Lima', 'bruno.lima@outlook.com', '31987651234');
    await go('/personalizar');
    return checked('Âmbar');
  });
  await step('15 a primeira conta mantém Turquesa', async () => {
    await signOut();
    await go('/entrar');
    await field('E-mail').fill('ana.souza@gmail.com');
    await field('Senha').fill(PASSWORD);
    await btn('Entrar', { wait: 2000 });
    await go('/personalizar');
    return checked('Turquesa');
  });
  await step('16 modo exemplo também personaliza, sem gravar', async () => {
    await signOut();
    await btn('Explorar com dados de exemplo', { wait: 4500 });
    await btn('Ajustes', { wait: 1000 });
    await tap('Personalizar o Baiu', { wait: 1000 });
    await radio('Rosa').click();
    await W(400);
    return checked('Rosa');
  });
};
