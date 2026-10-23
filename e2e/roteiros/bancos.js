// Bancos conectados pelo Open Finance, com o banco de teste: a jornada do Banco Central (termos, banco, CPF,
// confirmação), categorias, atualização, histórico de autorizações e cancelamento.
module.exports = async ({ page, step, go, btn, tap, field, text, W, signup, PASSWORD }) => {
  const CPF = '52998224725';
  const connect = async (bank = 'Banco Exemplo') => {
    await btn('Continuar', { wait: 1200 });
    await btn(bank, { wait: 700 });
    await field('CPF do titular da conta').fill(CPF);
    await btn('Ir para o banco', { wait: 3500 });
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
  await step('03 explica e mostra os termos da Celcoin (Disclaimer #1)', () => btn('Conecte seu banco', { wait: 1200 }), [
    'Conectar seu banco', 'O Baiu nunca vê sua senha', 'só para leitura', 'Celcoin', 'Polp', 'não guarda seus movimentos no servidor',
    'Ao continuar, você declara que concorda com os Termos de Uso', 'Norma de Privacidade Externa', 'Compliance e Regulatório', 'Continuar',
  ], ['Pluggy']);
  await step('04 escolhe o banco, com busca sem acento', async () => {
    await btn('Continuar', { wait: 1500 });
    await field('Buscar banco').fill('exemplo');
    await W(400);
  }, ['Escolha o banco', 'Selecione a conta de onde quer compartilhar seus dados', 'Banco Exemplo'], ['Banco Digital de Teste']);
  await step('05 banco fora do ar aparece marcado', async () => {
    await field('Buscar banco').fill('');
    await W(400);
  }, ['Banco Digital de Teste', 'Banco Parado de Teste', 'Fora do ar agora']);
  await step('06 confirmação: categorias, finalidade, prazo, segurança e Disclaimer #2', () => btn('Banco Exemplo', { wait: 900 }), [
    'Confira e autorize', 'CPF do titular da conta', 'Dados da conta', 'Cartão de crédito', 'Dados de investimento',
    'Caso sejam criadas novas operações de Dados da conta, Cartão de crédito ou Investimentos', 'Finalidade do Compartilhamento',
    'Prazo indeterminado: até você cancelar', 'Você será redirecionado pela Celcoin com a segurança do Open Finance',
    'Ao clicar em Ir para o banco, você autoriza a Celcoin', 'Você poderá revogar o compartilhamento através do Portal', 'Ir para o banco',
  ]);
  await step('07 detalhes da categoria e as finalidades abrem com um toque', async () => {
    const more = page.getByRole('button', { name: /Ver detalhes/ });
    await more.first().click();
    await W(400);
    await more.last().click();
    await W(400);
  }, ['saldo disponível, saldo bloqueado', 'Agregação e gestão de dados pessoais', 'Proteção dos direitos do usuário']);
  await step('08 CPF inválido não segue', async () => {
    await field('CPF do titular da conta').fill('11111111111');
    await W(300);
    const disabled = await page.getByRole('button', { name: 'Ir para o banco' }).first().isDisabled();
    if (!disabled) throw new Error('botão liberado com CPF inválido');
  });
  await step('09 conectado, com o resumo do que veio', async () => {
    await field('CPF do titular da conta').fill(CPF);
    await btn('Ir para o banco', { wait: 3500 });
  }, ['Conectado!', 'Banco Exemplo já está no Baiu', 'Contas e cartões', 'Movimentos', 'Investimentos', 'para você conferir a categoria', 'Conferir agora']);
  await step('10 confira: o que o Baiu não teve certeza', () => btn('Conferir agora', { wait: 1500 }), ['Confira', 'Pix Enviado Maria Oliveira', 'Comercial Xyz Ltda', 'Está tudo certo']);
  await step('11 corrigir uma categoria ensina o Baiu', async () => {
    const before = (await text()).split('Comercial Xyz Ltda').length - 1;
    await page.getByRole('button', { name: /^Comercial Xyz Ltda/ }).first().click();
    await W(600);
    await page.getByRole('radio', { name: 'Lazer', exact: true }).click();
    await W(900);
    const after = (await text()).split('Comercial Xyz Ltda').length - 1;
    if (!(before > 1 && after === 0)) throw new Error(`antes ${before}, depois ${after}`);
  }, ['Pix Enviado Maria Oliveira'], ['Comercial Xyz Ltda']);
  await step('12 confirmar todos', () => btn('Está tudo certo', { wait: 900 }), ['Tudo conferido']);
  await step('13 início: saldo do banco e sem pendências', () => go('/'), ['Saldo nas contas', 'Movimentos'], ['Conecte seu banco', 'Confira 1 movimento', 'movimentos que o Baiu']);
  await step('14 contas: conectadas e manuais', () => tap('Contas', { nth: -1, wait: 1000 }), ['Banco Exemplo', '· conectada', 'Cartão Exemplo Gold', 'Conectar banco', 'Adicionar conta à mão', 'Bancos conectados']);
  await step('15 extrato com tudo categorizado', () => tap('Extrato', { nth: -1, wait: 1200 }), ['Pagto Salario Acme Tecnologia Ltda', 'Ifood *Restaurante', 'Supermercado Dia', 'Netflix.com']);
  await step('16 detalhe de movimento do banco', async () => {
    await page.locator('text=Supermercado Dia >> visible=true').first().click();
    await W(1200);
  }, ['Veio do Banco Exemplo pelo Open Finance', 'Mercado', 'Tirar do Baiu'], ['Editar']);
  await step('17 trocar a categoria no detalhe', async () => {
    await page.getByRole('button', { name: /^Categoria/ }).first().click();
    await W(500);
    await page.getByRole('radio', { name: 'Alimentação', exact: true }).click();
    await W(700);
  }, ['Alimentação', 'Categoria escolhida por você']);
  await step('18 registrar à mão não usa conta conectada', () => go('/movimento/novo'), ['Suas contas se atualizam sozinhas']);
  await step('19 dados continuam depois de recarregar', () => go('/contas'), ['Cartão Exemplo Gold', '· conectada']);
  await step('20 bancos conectados', () => go('/bancos'), ['Bancos conectados', 'Banco Exemplo', 'Conectado · atualizado', 'Atualizar agora', 'Desconectar', 'Conectar outro banco', 'Suas autorizações', 'Ativa · desde']);
  await step('21 atualizar agora não duplica', async () => {
    await btn('Atualizar agora', { wait: 3500 });
    await go('/extrato');
    const n = (await text()).split('Pagto Salario Acme').length - 1;
    if (n > 4) throw new Error('salário duplicado: ' + n);
  });
  await step('22 conectar um segundo banco', async () => {
    await go('/conectar');
    await connect('Banco Digital de Teste');
  }, ['Conectado!', 'Banco Digital de Teste']);
  await step('23 desconectar mantendo os dados', async () => {
    await go('/bancos');
    await btn('Desconectar', { nth: 1, wait: 500 });
    await btn('Desconectar e manter os dados', { wait: 1500 });
  }, ['Banco Exemplo', 'Banco Digital de Teste', 'Cancelada · desde', '· cancelada em'], ['Desconectar e manter os dados']);
  await step('24 detalhe da autorização: prazo, finalidade, categorias e cancelar', async () => {
    await page.getByRole('button', { name: /^Banco Exemplo/ }).last().click();
    await W(1500);
  }, ['Autorizada em', 'Prazo indeterminado: até você cancelar', 'Dados compartilhados', 'Dados de investimento', 'Finalidade do Compartilhamento', 'Cancelar autorização']);
  await step('25 cancelar avisa que o compartilhamento para', () => btn('Cancelar autorização', { wait: 600 }), [
    'interrompe o compartilhamento de dados', 'Cancelar e manter os dados no Baiu', 'Cancelar e apagar os dados',
  ]);
  await step('26 voltar sem cancelar', async () => {
    await btn('Voltar', { nth: -1, wait: 400 });
    await go('/bancos');
  }, ['Banco Exemplo', 'Desconectar']);
  await step('27 desconectar apagando os dados', async () => {
    await btn('Desconectar', { wait: 500 });
    await btn('Desconectar e apagar os dados', { wait: 1500 });
  }, ['Nenhum banco conectado ainda', 'Suas autorizações', 'Cancelada · desde'], ['Ativa · desde']);
  await step('28 sobrou só o que foi mantido, agora manual', async () => {
    await go('/contas');
    const fake = await fakeBank();
    if (fake.items.length !== 0) throw new Error('conexões no provedor: ' + fake.items.length);
  }, ['Cartão Exemplo Gold'], ['· conectada']);
  await step('29 excluir a conta desconecta os bancos antes', async () => {
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
