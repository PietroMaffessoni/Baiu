// Assinatura com a loja de teste: mês grátis, bloqueio, cancelamento, fim do período, anual e exclusão.
module.exports = async ({ page, step, go, btn, tap, field, signup, PASSWORD }) => {
  /** Mexe na loja de teste como se o tempo tivesse passado. */
  const setSub = (patch) =>
    page.evaluate((p) => {
      const d = JSON.parse(localStorage.getItem('baiu:fake-store') || '{}');
      const uid = Object.keys(d.subs)[0];
      d.subs[uid] = { ...d.subs[uid], ...p };
      localStorage.setItem('baiu:fake-store', JSON.stringify(d));
    }, patch);
  const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

  await go('/');
  await step('01 modo exemplo não pede assinatura', () => btn('Explorar com dados de exemplo', { wait: 4500 }), ['Saldo nas contas'], ['Seu primeiro mês é por nossa conta']);
  await step('02 ajustes do exemplo sem assinatura', () => btn('Ajustes', { wait: 1200 }), ['Sair do modo exemplo'], ['Planos, cobrança e cancelamento', 'Mês grátis até']);

  await signup('Marina Couto', 'marina.couto@gmail.com', '11996421873', { subscribe: false });
  await step('03 conta nova: tela de assinatura com o mês grátis', async () => {}, [
    'Seu primeiro mês é por nossa conta', 'Use tudo por 1 mês sem pagar nada. Depois, R$ 24,90 por mês', 'Bancos conectados',
    'Privado de verdade', 'Mensal', 'Anual', 'R$ 229,90 por ano · R$ 19,16 por mês', '1º mês grátis', 'Começar meu mês grátis',
    'Grátis por 1 mês. Depois, R$ 24,90 por mês, cobrados na sua conta da loja de teste, com renovação automática até você cancelar',
    'cancele até 24 horas antes do fim do período grátis', 'Avisamos 2 dias antes', 'Restaurar compras', 'Termos de uso', 'Privacidade',
    'Seus dados continuam seus', 'Minha conta',
  ], ['Saldo nas contas', 'Exportar movimentos']);
  await step('04 sem assinatura, o início leva de volta para assinar', () => go('/'), ['Começar meu mês grátis'], ['Saldo nas contas']);
  await step('05 sem assinatura, o extrato também', () => go('/extrato'), ['Começar meu mês grátis'], ['Movimentos de']);
  await step('06 sem assinatura, os termos abrem', () => go('/termos'), ['Assinatura e pagamento', 'Arrependimento e reembolso', 'Código de Defesa do Consumidor']);
  await step('07 sem assinatura, minha conta abre (sair e excluir)', async () => {
    await go('/assinatura');
    await tap('Minha conta', { wait: 1200 });
  }, ['Sair da conta', 'Excluir conta']);
  await step('08 restaurar sem compra avisa com calma', async () => {
    await go('/assinatura');
    await tap('Restaurar compras', { wait: 1500 });
  }, ['Não encontramos uma assinatura ativa nesta conta da loja de teste']);
  await step('09 começar o mês grátis abre o app', () => btn('Começar meu mês grátis', { wait: 3000 }), ['Saldo nas contas', 'Conecte seu banco'], ['Começar meu mês grátis']);
  await step('10 continua liberado depois de recarregar', () => go('/'), ['Saldo nas contas']);
  await step('11 ajustes mostram a assinatura', () => go('/ajustes'), ['Assinatura', 'Mês grátis até']);
  await step('12 tela da assinatura: estado, datas e caminho para cancelar', () => tap('Assinatura', { wait: 1500 }), [
    'Mês grátis até', 'Depois, são R$ 24,90 por mês, pela loja de teste', 'Plano', 'Mensal', 'Preço', 'Cobrada por', 'Primeira cobrança',
    'Avisar antes da cobrança', 'Cancelar assinatura', 'Pedir reembolso', 'até 7 dias', 'Falar com o suporte',
  ]);
  await step('13 cancelar explica antes de ir para a loja', () => btn('Cancelar assinatura'), [
    'Como cancelar', 'Quem cobra a assinatura é a loja de teste', 'Você continua usando tudo até', 'e não paga nada', 'Ir para a loja de teste', 'Manter assinatura',
  ]);
  await step('14 manter assinatura volta atrás', () => btn('Manter assinatura', { wait: 500 }), ['Cancelar assinatura'], ['Como cancelar']);
  await step('15 cancelada: usa até o fim, sem cobrança', async () => {
    await btn('Cancelar assinatura', { wait: 500 });
    await btn('Ir para a loja de teste', { wait: 1500 });
  }, ['Assinatura cancelada', 'Você usa o Baiu até', 'Depois disso, não há cobrança', 'Acesso até', 'Voltar a assinar'], ['Primeira cobrança']);
  await step('16 cancelada ainda usa o app', () => go('/'), ['Saldo nas contas'], ['Seu mês grátis acaba']);
  await step('17 voltar a assinar', async () => {
    await go('/assinatura');
    await btn('Voltar a assinar', { wait: 1500 });
  }, ['Mês grátis até', 'Cancelar assinatura']);
  await step('18 aviso no início quando o mês grátis está acabando', async () => {
    await setSub({ until: inDays(1.5) });
    await go('/');
  }, ['Seu mês grátis acaba em 2 dias', 'Toque para ver os detalhes ou cancelar']);
  await step('19 problema no pagamento aparece no início', async () => {
    await setSub({ until: inDays(20), trial: false, billingIssue: true });
    await go('/');
  }, ['Problema no pagamento da assinatura'], ['Seu mês grátis acaba']);
  await step('20 e na assinatura, com o botão certo', () => go('/assinatura'), ['Problema no pagamento', 'Atualizar forma de pagamento', 'Prazo para acertar']);
  await step('21 fim do período sem renovar: volta para assinar, sem novo mês grátis', async () => {
    await setSub({ until: inDays(-1), willRenew: false, billingIssue: false });
    await go('/');
  }, [
    'Que bom te ver de novo', 'Sua assinatura terminou', 'Seus registros continuam guardados neste aparelho', 'Assinar por R$ 24,90 por mês',
    'Cancele quando quiser, em Ajustes, Assinatura, até 24 horas antes da renovação',
  ], ['Começar meu mês grátis', '1º mês grátis', 'Saldo nas contas']);
  await step('22 assinar o anual', async () => {
    await page.getByRole('radio', { name: /^Anual/ }).click();
    await page.waitForTimeout(500);
    await btn('Assinar por R$ 229,90 por ano', { wait: 3000 });
  }, ['Saldo nas contas']);
  await step('23 anual na tela da assinatura', () => go('/assinatura'), ['Assinatura ativa', 'Anual', 'R$ 229,90 por ano', 'Próxima cobrança']);
  await step('24 excluir a conta avisa que a loja continua cobrando', async () => {
    await go('/minha-conta');
    await btn('Excluir conta', { wait: 500 });
  }, ['Sua assinatura continua ativa na loja de teste', 'Excluir a conta não cancela a cobrança', 'Cancelar a assinatura primeiro']);
  await step('25 excluir apaga o cadastro da assinatura', async () => {
    await field('Sua senha').fill(PASSWORD);
    await btn('Excluir conta para sempre', { wait: 3500 });
    const d = await page.evaluate(() => JSON.parse(localStorage.getItem('baiu:fake-store') || '{}'));
    if (Object.keys(d.subs).length !== 0) throw new Error('ficou cadastro: ' + Object.keys(d.subs).length);
  }, ['Criar conta']);
  await step('26 só com o plano mensal, a tela não mostra o anual', async () => {
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('baiu:fake-store') || '{}');
      localStorage.setItem('baiu:fake-store', JSON.stringify({ ...d, offered: ['mensal'] }));
    });
    await signup('Otávio Reis', 'otavio.reis@gmail.com', '41998765432', { subscribe: false });
  }, ['Começar meu mês grátis', 'R$ 24,90 por mês'], ['Anual', 'R$ 229,90']);
};
module.exports.pace = { go: 1800, btn: 900 };
