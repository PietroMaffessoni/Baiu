// Contas de usuário: cadastro com validação, código por e-mail, login, recuperação, dados e exclusão.
module.exports = async ({ page, step, go, btn, tap, field, fill, typeIn, keys, W, passPaywall, CODE }) => {
  // ---------- sem conta ----------
  await go('/');
  await step('01 boas-vindas tem criar conta, entrar e exemplo', async () => {}, ['Criar conta', 'Já tenho conta', 'Explorar com dados de exemplo']);
  await step('02 sem conta não abre o extrato', () => go('/extrato'), ['Criar conta'], ['Últimos 30 dias, todas as contas']);
  await step('03 sem conta não abre minha conta', () => go('/minha-conta'), ['Criar conta'], ['Seus dados']);

  // ---------- cadastro ----------
  await go('/');
  await step('04 abre o cadastro', () => btn('Criar conta'), ['Criar conta', 'Nome completo', 'Celular com DDD']);
  await step('05 enviar vazio mostra os erros', () => btn('Criar conta'), [
    'Confira os campos marcados em vermelho.',
    'Informe seu nome completo.',
    'Informe seu e-mail.',
    'Informe seu celular com DDD.',
  ]);
  await step('06 nome é formatado ao sair do campo', async () => {
    await fill('Nome completo', '  maria   DA silva ');
    const v = await field('Nome completo').inputValue();
    if (v !== 'Maria da Silva') throw new Error('nome ficou: ' + v);
  });
  await step('07 só um nome não vale', () => fill('Nome completo', 'Maria'), ['Informe nome e sobrenome.']);
  await step('08 e-mail com espaço e maiúscula é ajustado', async () => {
    await fill('Nome completo', 'maria da silva');
    await fill('E-mail', ' Maria.Silva@GMIAL.com ');
    const v = await field('E-mail').inputValue();
    if (v !== 'maria.silva@gmial.com') throw new Error('e-mail ficou: ' + v);
  }, ['Você quis dizer', 'maria.silva@gmail.com']);
  await step('09 sugestão corrige o provedor', async () => {
    await tap('Usar este', { wait: 300 });
    const v = await field('E-mail').inputValue();
    if (v !== 'maria.silva@gmail.com') throw new Error('e-mail ficou: ' + v);
  }, [], ['Você quis dizer']);
  await step('10 e-mail temporário é recusado', () => fill('E-mail', 'teste@mailinator.com'), ['E-mails temporários não são aceitos']);
  await step('11 e-mail sem @ é recusado', () => fill('E-mail', 'mariagmail.com'), ['O e-mail precisa ter um @']);
  await step('12 celular é formatado enquanto digita', async () => {
    await fill('E-mail', 'maria.silva@gmail.com');
    await typeIn('Celular com DDD', '11996421873');
    const v = await field('Celular com DDD').inputValue();
    if (v !== '(11) 99642-1873') throw new Error('celular ficou: ' + v);
  });
  const retypePhone = async (digits) => {
    await field('Celular com DDD').fill('');
    await typeIn('Celular com DDD', digits);
    await field('Celular com DDD').blur();
    await W(200);
  };
  await step('13 telefone fixo é recusado', () => retypePhone('1134567890'), ['Este parece um telefone fixo']);
  await step('14 DDD inexistente é recusado', () => retypePhone('20996421873'), ['O DDD 20 não existe no Brasil.']);
  await step('15 senha fraca mostra o que falta', async () => {
    await retypePhone('11996421873');
    await fill('Senha', 'maria123');
  }, ['Fraca', 'Uma letra maiúscula', 'Um símbolo']);
  await step('16 senha com o próprio nome é recusada', () => fill('Senha', 'Maria#2024x'), ['Não use seu nome ou seu e-mail na senha.']);
  await step('17 senha comum é recusada', () => fill('Senha', 'Flamengo@2024'), ['Essa senha é fácil de adivinhar.']);
  await step('18 senha forte é aceita', () => fill('Senha', 'Lanterna#42baiacu'), ['Forte'], ['fácil de adivinhar', 'Não use seu nome']);
  await step('19 sem marcar os aceites não cria a conta', () => btn('Criar conta'), ['marque as duas confirmações']);
  await step('20 termos abrem a partir do cadastro', () => tap('Termos de uso', { wait: 900 }), ['Sua conta', 'Você precisa ter 18 anos ou mais']);
  await step('21 voltar mantém o que foi digitado', async () => {
    await page.goBack();
    await W(900);
    const v = await field('E-mail').inputValue();
    if (v !== 'maria.silva@gmail.com') throw new Error('perdeu o e-mail: ' + v);
  });
  await step('22 cria a conta e pede o código', async () => {
    await btn('Li e aceito os Termos de uso e a Política de privacidade', { role: 'checkbox' });
    await btn('Tenho 18 anos ou mais', { role: 'checkbox' });
    await btn('Criar conta', { wait: 1500 });
  }, ['Confirme seu e-mail', 'maria.silva@gmail.com']);
  await step('23 código errado é recusado', async () => {
    await field('Código de confirmação').fill('000000');
    await W(1200);
  }, ['Código incorreto ou vencido']);
  await step('24 reenvio espera um minuto', async () => {}, ['Reenviar código em']);
  await step('25 código certo entra no app', async () => {
    await field('Código de confirmação').fill(CODE);
    await passPaywall();
  }, ['Saldo nas contas'], ['Confirme seu e-mail']);

  // ---------- dados da conta ----------
  await step('26 cadastra uma conta bancária', async () => {
    await go('/nova-conta');
    await tap('Nubank', { wait: 300 });
    await tap('Conta corrente');
    await keys('250000');
    await btn('Adicionar conta', { wait: 900 });
    await go('/contas');
  }, ['R$ 2.500,00']);
  await step('27 continua logado e com os dados depois de recarregar', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await W(1500);
    await go('/contas');
  }, ['R$ 2.500,00']);
  await step('28 ajustes mostra a conta', () => go('/ajustes'), ['Maria da Silva', 'maria.silva@gmail.com']);
  await step('29 minha conta mostra os dados', async () => {
    await tap('Maria da Silva', { wait: 1000 });
    const v = [await field('Nome completo').inputValue(), await field('Celular com DDD').inputValue(), await field('E-mail').inputValue()];
    if (v.join('|') !== 'Maria da Silva|(11) 99642-1873|maria.silva@gmail.com') throw new Error('campos: ' + v.join('|'));
  }, ['Seus dados', 'Excluir conta']);
  await step('30 mensagem de dados salvos aparece', async () => {
    await field('Nome completo').fill('Maria da Silva Souza');
    await W(200);
    await btn('Salvar dados', { wait: 1200 });
  }, ['Dados atualizados.']);
  await step('31 celular inválido não salva', async () => {
    await field('Celular com DDD').fill('');
    await typeIn('Celular com DDD', '1188');
  }, ['Faltam números']);
  await step('32 celular válido salva', async () => {
    await field('Celular com DDD').fill('');
    await typeIn('Celular com DDD', '21991234560');
    await btn('Salvar dados', { wait: 1200 });
    await go('/minha-conta');
    const v = await field('Celular com DDD').inputValue();
    if (v !== '(21) 99123-4560') throw new Error('celular salvo: ' + v);
  });
  await step('33 trocar senha com a atual errada', async () => {
    await btn('Trocar senha');
    await fill('Senha atual', 'Errada#123x');
    await fill('Senha nova', 'Peixe-Lua#2077');
    await btn('Salvar senha nova', { wait: 1200 });
  }, ['A senha atual está incorreta.']);
  await step('34 trocar senha com a atual certa', async () => {
    await fill('Senha atual', 'Lanterna#42baiacu');
    await btn('Salvar senha nova', { wait: 1200 });
  }, ['Senha trocada.']);
  await step('35 sair da conta volta ao início', () => btn('Sair da conta', { wait: 1500 }), ['Criar conta', 'Já tenho conta']);
  await step('36 depois de sair, o app fica fechado', () => go('/contas'), ['Criar conta'], ['R$ 2.500,00']);

  // ---------- login ----------
  await step('37 senha antiga não entra', async () => {
    await go('/entrar');
    await fill('E-mail', 'maria.silva@gmail.com');
    await fill('Senha', 'Lanterna#42baiacu', false);
    await btn('Entrar', { wait: 1200 });
  }, ['E-mail ou senha incorretos.']);
  await step('38 cinco erros seguidos pausam o login', async () => {
    for (let i = 0; i < 4; i++) await btn('Entrar', { wait: 900 });
  }, ['Muitas tentativas erradas', 'Tente de novo em']);
  await step('39 senha nova entra e os dados voltam', async () => {
    await go('/entrar');
    await fill('E-mail', 'maria.silva@gmail.com');
    await fill('Senha', 'Peixe-Lua#2077', false);
    await btn('Entrar', { wait: 2000 });
    await go('/contas');
  }, ['R$ 2.500,00']);

  // ---------- outra pessoa no mesmo aparelho ----------
  const signupForm = async (name, email, phone, password) => {
    await go('/cadastro');
    await fill('Nome completo', name);
    await fill('E-mail', email);
    await typeIn('Celular com DDD', phone);
    await fill('Senha', password);
    await btn('Li e aceito os Termos de uso e a Política de privacidade', { role: 'checkbox' });
    await btn('Tenho 18 anos ou mais', { role: 'checkbox' });
    await btn('Criar conta', { wait: 1500 });
  };
  await step('40 outra conta no mesmo aparelho não vê os dados da primeira', async () => {
    await go('/minha-conta');
    await btn('Sair da conta', { wait: 1500 });
    await signupForm('joão pereira', 'joao.pereira@outlook.com', '31987651234', 'Mar-Azul#5150');
    await field('Código de confirmação').fill(CODE);
    await passPaywall();
    await go('/contas');
  }, ['0 contas cadastradas'], ['R$ 2.500,00', 'Nubank']);
  await step('41 cadastro repetido não revela a conta existente', async () => {
    await go('/minha-conta');
    await btn('Sair da conta', { wait: 1500 });
    await signupForm('Maria da Silva', 'maria.silva@gmail.com', '11996421873', 'Outra-Senha#8080');
  }, ['Confirme seu e-mail', 'Se este e-mail já tiver conta no Baiu, nenhum código é enviado.']);

  // ---------- recuperar senha ----------
  await step('42 esqueci a senha pede o e-mail', async () => {
    await go('/entrar');
    await fill('E-mail', 'maria.silva@gmail.com');
    await tap('Esqueci minha senha', { wait: 900 });
  }, ['Recuperar senha']);
  await step('43 envia o código e pede a senha nova', () => btn('Enviar código', { wait: 1200 }), ['Crie uma senha nova', 'Reenviar código em']);
  await step('44 código errado na recuperação', async () => {
    await fill('Código', '999999');
    await fill('Senha nova', 'Sol-Nascente#33', false);
    await btn('Salvar senha nova', { wait: 1200 });
  }, ['Código incorreto ou vencido']);
  await step('45 código certo troca a senha e entra', async () => {
    await fill('Código', CODE);
    await btn('Salvar senha nova', { wait: 2500 });
    await go('/contas');
  }, ['R$ 2.500,00']);

  // ---------- excluir conta ----------
  await step('46 excluir conta pede a senha certa', async () => {
    await go('/minha-conta');
    await btn('Excluir conta');
    await fill('Sua senha', 'Errada#123x', false);
    await btn('Excluir conta para sempre', { wait: 1200 });
  }, ['Senha incorreta.']);
  await step('47 excluir conta volta ao início', async () => {
    await fill('Sua senha', 'Sol-Nascente#33', false);
    await btn('Excluir conta para sempre', { wait: 2000 });
  }, ['Criar conta']);
  await step('48 conta excluída não entra mais', async () => {
    await go('/entrar');
    await fill('E-mail', 'maria.silva@gmail.com');
    await fill('Senha', 'Sol-Nascente#33', false);
    await btn('Entrar', { wait: 1200 });
  }, ['E-mail ou senha incorretos.']);
  await step('49 dados financeiros da conta excluída saíram do aparelho', async () => {
    const all = await page.evaluate(() => Object.keys(localStorage));
    const left = all.filter((k) => k.startsWith('baiu:vault:v3:') || k.startsWith('baiu.vault.key'));
    // só a conta do João deve ter cofre (os dados e a chave)
    if (left.length !== 2) throw new Error('cofres no aparelho: ' + left.join(', '));
  });

  // ---------- modo exemplo ----------
  await step('50 exemplo abre sem conta', async () => {
    await go('/');
    await btn('Explorar com dados de exemplo', { wait: 4500 });
  }, ['Fôlego', 'Saldo nas contas']);
  await step('51 exemplo não tem minha conta', () => btn('Ajustes', { wait: 1200 }), ['Sair do modo exemplo'], ['Minha conta', 'Apagar dados deste aparelho']);
  await step('52 sair do exemplo volta ao início', () => btn('Sair do modo exemplo', { wait: 1500 }), ['Criar conta']);
  await step('53 exemplo não fica gravado', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await W(1500);
  }, ['Criar conta']);
};
