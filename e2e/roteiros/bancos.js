// Bancos conectados pelo Open Finance, com o banco de teste: autorização, categorias, atualização e desconexão.
module.exports = async ({ page, step, go, btn, tap, field, text, W, signup, PASSWORD }) => {
  const connect = async (bank = 'Banco Exemplo') => {
    await btn('Concordo e quero conectar', { wait: 1200 });
    await btn(bank);
    await btn('Autorizar', { wait: 3500 });
  };
  const fakeBank = () => page.evaluate(() => JSON.parse(localStorage.getItem('baiu:fake-bank') || '{"items":[]}'));

  await go('/');

  // ---------- modo exemplo ----------
  await step('01 no exemplo, conectar pede conta', async () => {
    await btn('Explorar com dados de exemplo', { wait: 4500 });
    await tap('Contas', { nth: -1, wait: 900 });
    await btn('Adicionar conta à mão', { wait: 900 });
  }, ['Qual é o banco?'], ['Conectar pelo Open Finance']);

  // ---------- conta real ----------
  await signup('Helena Prado', 'helena.prado@gmail.com', '11996421873');
  await step('02 conta nova: convite para conectar o banco', async () => {}, ['Conecte seu banco', 'Pelo Open Finance, cada entrada e saída aparece aqui sozinha']);
  await step('03 explica e pede a autorização (LGPD)', () => btn('Conecte seu banco', { wait: 1200 }), [
    'Conectar seu banco', 'O Baiu nunca vê sua senha', 'só para leitura', 'Pluggy', 'Não guardamos seus movimentos no servidor', 'Como cancelar', 'Concordo e quero conectar',
  ]);
  await step('04 escolhe o banco e autoriza', () => btn('Concordo e quero conectar', { wait: 1200 }), ['AMBIENTE DE TESTE', 'Escolha seu banco', 'Banco Exemplo']);
  await step('05 conectado, com o resumo do que veio', async () => {
    await btn('Banco Exemplo');
    await btn('Autorizar', { wait: 3500 });
  }, ['Conectado!', 'Banco Exemplo já está no Baiu', 'Contas e cartões', 'Movimentos', 'Investimentos', 'para você conferir a categoria', 'Conferir agora']);
  await step('06 confira: o que o Baiu não teve certeza', () => btn('Conferir agora', { wait: 1500 }), ['Confira', 'Pix Enviado Maria Oliveira', 'Comercial Xyz Ltda', 'Está tudo certo']);
  await step('07 corrigir uma categoria ensina o Baiu', async () => {
    const before = (await text()).split('Comercial Xyz Ltda').length - 1;
    await page.getByRole('button', { name: /^Comercial Xyz Ltda/ }).first().click();
    await W(600);
    await page.getByRole('radio', { name: 'Lazer', exact: true }).click();
    await W(900);
    const after = (await text()).split('Comercial Xyz Ltda').length - 1;
    if (!(before > 1 && after === 0)) throw new Error(`antes ${before}, depois ${after}`);
  }, ['Pix Enviado Maria Oliveira'], ['Comercial Xyz Ltda']);
  await step('08 confirmar todos', () => btn('Está tudo certo', { wait: 900 }), ['Tudo conferido']);
  await step('09 início: saldo do banco e sem pendências', () => go('/'), ['Saldo nas contas', 'Movimentos'], ['Conecte seu banco', 'Confira 1 movimento', 'movimentos que o Baiu']);
  await step('10 contas: conectadas e manuais', () => tap('Contas', { nth: -1, wait: 1000 }), ['Banco Exemplo', '· conectada', 'Cartão Exemplo Gold', 'Conectar banco', 'Adicionar conta à mão', 'Bancos conectados']);
  await step('11 extrato com tudo categorizado', () => tap('Extrato', { nth: -1, wait: 1200 }), ['Pagto Salario Acme Tecnologia Ltda', 'Ifood *Restaurante', 'Supermercado Dia', 'Netflix.com']);
  await step('12 detalhe de movimento do banco', async () => {
    await page.locator('text=Supermercado Dia >> visible=true').first().click();
    await W(1200);
  }, ['Veio do Banco Exemplo pelo Open Finance', 'Mercado', 'Tirar do Baiu'], ['Editar']);
  await step('13 trocar a categoria no detalhe', async () => {
    await page.getByRole('button', { name: /^Categoria/ }).first().click();
    await W(500);
    await page.getByRole('radio', { name: 'Alimentação', exact: true }).click();
    await W(700);
  }, ['Alimentação', 'Categoria escolhida por você']);
  await step('14 registrar à mão não usa conta conectada', () => go('/movimento/novo'), ['Suas contas se atualizam sozinhas']);
  await step('15 dados continuam depois de recarregar', () => go('/contas'), ['Cartão Exemplo Gold', '· conectada']);
  await step('16 bancos conectados', () => go('/bancos'), ['Bancos conectados', 'Banco Exemplo', 'Conectado · atualizado', 'Atualizar agora', 'Desconectar', 'Conectar outro banco']);
  await step('17 atualizar agora não duplica', async () => {
    await btn('Atualizar agora', { wait: 3500 });
    await go('/extrato');
    const n = (await text()).split('Pagto Salario Acme').length - 1;
    if (n > 4) throw new Error('salário duplicado: ' + n);
  });
  await step('18 conectar um segundo banco', async () => {
    await go('/conectar');
    await connect('Banco Digital de Teste');
  }, ['Conectado!', 'Banco Digital de Teste']);
  await step('19 desconectar mantendo os dados', async () => {
    await go('/bancos');
    await btn('Desconectar', { nth: 1, wait: 500 });
    await btn('Desconectar e manter os dados', { wait: 1500 });
  }, ['Banco Exemplo'], ['Banco Digital de Teste']);
  await step('20 desconectar apagando os dados', async () => {
    await btn('Desconectar', { wait: 500 });
    await btn('Desconectar e apagar os dados', { wait: 1500 });
  }, ['Nenhum banco conectado ainda'], ['Banco Exemplo']);
  await step('21 sobrou só o que foi mantido, agora manual', async () => {
    await go('/contas');
    const fake = await fakeBank();
    if (fake.items.length !== 0) throw new Error('conexões no provedor: ' + fake.items.length);
  }, ['Cartão Exemplo Gold'], ['· conectada']);
  await step('22 excluir a conta desconecta os bancos antes', async () => {
    await go('/conectar');
    await connect();
    await go('/minha-conta');
    await btn('Excluir conta', { wait: 500 });
    await field('Sua senha').fill(PASSWORD);
    await btn('Excluir conta para sempre', { wait: 3000 });
    const fake = await fakeBank();
    if (fake.items.length !== 0) throw new Error('ficaram conexões: ' + fake.items.length);
  }, ['Criar conta']);
};
module.exports.pace = { go: 1500, btn: 700 };
