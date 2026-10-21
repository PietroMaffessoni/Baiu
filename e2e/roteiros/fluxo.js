// Uso do dia a dia com uma conta real: contas, movimentos, vencimentos, investimentos e modo exemplo.
module.exports = async ({ page, step, go, btn, tap, radio, keys, field, text, W, signup }) => {
  const addAccount = async (bank, kind, digits, nick, due) => {
    await go('/nova-conta');
    await tap(bank, { wait: 300 });
    if (kind) await tap(kind);
    if (nick) await page.getByLabel('Apelido da conta, opcional').fill(nick);
    if (due) await radio(String(due));
    await keys(digits);
    await btn('Adicionar conta', { wait: 1300 });
  };
  const addTx = async (kind, digits, desc, cat, from, to) => {
    await go('/movimento/novo');
    if (kind !== 'Saída') await tap(kind);
    await keys(digits);
    await btn('Continuar');
    await field('Descrição').fill(desc);
    if (cat) await tap(cat);
    if (from) await radio(...from);
    if (to) await radio(...to);
    await btn('Salvar movimento', { wait: 1300 });
  };
  const clearAmount = async () => {
    for (let i = 0; i < 9; i++) await btn('Apagar', { wait: 30 });
  };

  await step('01 cria conta e entra', () => signup('Teste Silva', 'teste.silva@gmail.com', '11996421873'), ['Saldo nas contas', 'Fôlego']);
  await step('02 conta corrente Nubank R$ 5.000', () => addAccount('Nubank', 'Conta corrente', '500000', 'Principal'), ['Conta adicionada']);
  await step('03 reserva Itaú R$ 10.000', () => addAccount('Itaú', 'Reserva', '1000000', 'Reserva'), ['Conta adicionada']);
  await step('04 cartão Inter fatura R$ 1.200 vence 20', () => addAccount('Inter', 'Cartão de crédito', '120000', 'Cartão Inter', 20), ['Conta adicionada']);
  await step('05 corretora XP R$ 0', () => addAccount('XP Investimentos', 'Investimentos', '', 'XP'), ['Conta adicionada']);
  await step('06 entrada salário R$ 8.000', () => addTx('Entrada', '800000', 'Salário', 'Salário', ['Principal']), [], ['Escolha']);
  await step('07 saída mercado R$ 1.500', () => addTx('Saída', '150000', 'Mercado do mês', 'Mercado', ['Principal']));
  await step('08 compra no cartão R$ 300', () => addTx('Saída', '30000', 'Restaurante', 'Alimentação', ['Cartão Inter']));
  await step('09 transferência para XP R$ 1.000', () => addTx('Transferência', '100000', 'Aporte XP', null, ['Principal'], ['XP', 1]), [], ['Escolha a conta']);
  await step('10 transferência paga fatura R$ 500', () => addTx('Transferência', '50000', 'Pagar fatura', null, ['Principal'], ['Cartão Inter']), [], ['Escolha a conta']);
  await step('11 validação: transferência sem destino', async () => {
    await go('/movimento/novo');
    await tap('Transferência');
    await keys('100');
    await btn('Continuar');
    await btn('Salvar movimento');
  }, ['Escolha a conta de destino.']);
  await step('12 extrato', () => go('/extrato'), ['Salário', 'Mercado do mês', 'Restaurante', 'Aporte XP', 'Pagar fatura']);
  // Principal 5000+8000-1500-1000-500 = 10.000; cartão 1200+300-500 = 1.000; XP 1.000; reserva 10.000
  await step('13 saldos (Principal 10.000, cartão −1.000, XP 1.000)', () => go('/contas'), ['−R$ 1.000,00', 'XP Investimentos · Investimentos | R$ 1.000,00', 'Nubank · Conta corrente | R$ 10.000,00']);
  await step('14 início', () => go('/'), ['Fôlego', 'Saldo nas contas']);
  await step('15 fôlego detalhado', () => go('/folego'), ['Gastou menos do que entrou', 'Reserva de emergência', 'Contas em dia', 'Investiu este mês']);
  await step('16 selos', () => go('/selos'), ['Primeira conta']);
  await step('17 novo vencimento Aluguel R$ 2.000', async () => {
    await go('/vencimento/novo');
    await keys('200000');
    await btn('Continuar');
    await field('Nome do vencimento').fill('Aluguel');
    await tap('Casa');
    await btn('Salvar vencimento', { wait: 1300 });
    await go('/vencimentos');
  }, ['Aluguel', 'Fatura Cartão Inter']);
  await step('18 validação: vencimento sem nome', async () => {
    await go('/vencimento/novo');
    await keys('100');
    await btn('Continuar');
    await btn('Salvar vencimento');
  }, ['Dê um nome ao vencimento']);
  await step('19 pagar Aluguel cria o do mês seguinte', async () => {
    await go('/vencimentos');
    await tap('Aluguel', { wait: 800 });
    await btn('Marcar como pago', { wait: 1400 });
    await go('/vencimentos');
  }, ['Pago em']);
  await step('20 pagamento virou saída no extrato', () => go('/extrato'), ['Aluguel']);
  await step('21 investimento CDB R$ 600 do saldo parado', async () => {
    await go('/investimento/novo');
    await field('Nome do investimento').fill('CDB Liquidez');
    await radio('CDB');
    await radio('Saldo parado');
    await btn('Continuar');
    await keys('60000');
    await btn('Salvar investimento', { wait: 1300 });
    await go('/investir');
  }, ['CDB Liquidez']);
  await step('22 validação: aplicar mais que o saldo parado', async () => {
    await go('/investimento/novo');
    await field('Nome do investimento').fill('Tesouro');
    await radio('Saldo parado');
    await btn('Continuar');
    await keys('99999');
    await btn('Salvar investimento');
  }, ['O saldo parado na corretora é']);
  await step('23 investimento de outra conta R$ 1.000 (Reserva)', async () => {
    await go('/investimento/novo');
    await field('Nome do investimento').fill('Tesouro Selic');
    await radio('Tesouro');
    await radio('De outra conta');
    await radio('Reserva');
    await btn('Continuar');
    await keys('100000');
    await btn('Salvar investimento', { wait: 1300 });
    await go('/investir');
  }, ['Tesouro Selic', 'CDB Liquidez']);
  await step('24 atualizar valor do CDB para R$ 650', async () => {
    await go('/investir');
    await tap('CDB Liquidez', { wait: 800 });
    await btn('Atualizar valor');
    await clearAmount();
    await keys('65000');
    await btn('Salvar', { wait: 1300 });
    await go('/investir');
  }, ['650,00']);
  await step('25 resgatar R$ 200 do CDB para Principal', async () => {
    await go('/investir');
    await tap('CDB Liquidez', { wait: 800 });
    await btn('Resgatar');
    await radio('Principal');
    await keys('20000');
    await btn('Salvar', { wait: 1300 });
    await go('/extrato');
  }, ['Resgate de CDB Liquidez']);
  await step('26 validação: resgatar mais do que vale', async () => {
    await go('/investir');
    await tap('CDB Liquidez', { wait: 800 });
    await btn('Resgatar');
    await keys('999999');
    await btn('Salvar');
  }, ['O investimento vale']);
  await step('27 editar movimento (mercado 1.500 → 1.200)', async () => {
    await go('/extrato');
    await tap('Mercado do mês', { wait: 800 });
    await btn('Editar');
    await tap('Alterar');
    await clearAmount();
    await keys('120000');
    await btn('Continuar');
    await btn('Salvar alterações', { wait: 1300 });
    await go('/extrato');
  }, ['1.200,00'], ['1.500,00']);
  await step('28 apagar movimento (restaurante)', async () => {
    await go('/extrato');
    await tap('Restaurante', { wait: 800 });
    await btn('Apagar movimento', { wait: 1300 });
    await go('/extrato');
  }, [], ['Restaurante']);
  await step('29 detalhe da conta Reserva', async () => {
    await go('/contas');
    await btn('Reserva, Reserva', { wait: 1300 });
  }, ['Reserva']);
  await step('30 ocultar valores', async () => {
    await go('/ajustes');
    await btn('Ocultar valores', { role: 'switch' });
    await go('/');
  }, ['••••']);
  await step('31 mostrar valores de novo', async () => {
    await go('/ajustes');
    await btn('Ocultar valores', { role: 'switch' });
    await go('/');
  }, [], ['••••']);
  await step('32 dados persistem após recarregar', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await W(1500);
    await go('/extrato');
  }, ['Salário', 'Aluguel']);
  await step('33 dados gravados cifrados', async () => {
    const raw = await page.evaluate(() => {
      const k = Object.keys(localStorage).find((x) => x.startsWith('baiu:vault:v3:'));
      return k ? localStorage.getItem(k) : '';
    });
    if (!raw.startsWith('b1.') || raw.includes('Salário') || raw.includes('Aluguel')) throw new Error('dados não estão cifrados: ' + raw.slice(0, 80));
  });
  await step('34 privacidade e termos', async () => {
    await go('/privacidade');
    const a = await text();
    await go('/termos');
    if (a.length < 300) throw new Error('privacidade curta');
  }, ['Termos']);
  await step('35 apagar dados do aparelho esvazia e mantém a conta', async () => {
    await go('/ajustes');
    await btn('Apagar dados deste aparelho', { wait: 2000 });
    await go('/contas');
  }, ['0 contas cadastradas']);
  await step('36 sair da conta', async () => {
    await go('/minha-conta');
    await btn('Sair da conta', { wait: 1500 });
  }, ['Cuide do seu dinheiro.']);
  await step('37 modo exemplo', () => btn('Explorar com dados de exemplo', { wait: 4500 }), ['Fôlego']);
  await step('38 exemplo: contas', () => tap('Contas', { nth: -1, wait: 900 }), ['Patrimônio líquido']);
  await step('39 exemplo: extrato', () => tap('Extrato', { nth: -1, wait: 900 }), ['Hoje']);
  await step('40 exemplo: investir', () => tap('Investir', { nth: -1, wait: 900 }), ['Constância']);
};
