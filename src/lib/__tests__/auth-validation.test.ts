import {
  checkEmail,
  checkName,
  checkPassword,
  checkPhone,
  cleanCode,
  formatName,
  formatPhone,
  normalizeEmail,
  passwordProblem,
  passwordRules,
  passwordStrength,
  suggestDomain,
} from '../auth/validation';

describe('e-mail', () => {
  it('tira espaços e passa para minúsculas', () => {
    expect(normalizeEmail('  Maria.Silva @Gmail.COM ')).toBe('maria.silva@gmail.com');
  });

  it.each([
    'maria@gmail.com',
    'joao.pedro+baiu@outlook.com.br',
    'ana_souza@empresa.com.br',
    'x@sub.dominio.io',
  ])('aceita %s', (e) => {
    expect(checkEmail(e).ok).toBe(true);
  });

  it.each([
    ['', 'Informe seu e-mail.'],
    ['mariagmail.com', '@'],
    ['maria@', 'provedor'],
    ['maria@@gmail.com', '@'],
    ['ma ria@gmail', 'provedor'],
    ['.maria@gmail.com', 'caracteres'],
    ['maria..silva@gmail.com', 'caracteres'],
    ['maria@gmail', 'provedor'],
    ['maria@gmail.c', 'provedor'],
    ['maria@-gmail.com', 'provedor'],
    ['maria@gmail.com1', 'provedor'],
  ])('recusa "%s"', (e, part) => {
    const r = checkEmail(e);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(part);
  });

  it('recusa e-mail temporário', () => {
    const r = checkEmail('teste@mailinator.com');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/temporários/);
  });

  it.each([
    ['gmial.com', 'gmail.com'],
    ['gmai.com', 'gmail.com'],
    ['gmail.co', 'gmail.com'],
    ['gmail.con', 'gmail.com'],
    ['gmail.com.br', 'gmail.com'],
    ['hotmial.com', 'hotmail.com'],
    ['hotmail.co', 'hotmail.com'],
    ['outlok.com', 'outlook.com'],
    ['yahoo.com.b', 'yahoo.com.br'],
    ['icloud.com.br', 'icloud.com'],
    ['uol.com.br', undefined],
    ['bol.com.br', undefined],
    ['mail.com', undefined],
    ['empresa.com.br', undefined],
    ['usp.br', undefined],
  ])('sugere correção para %s', (domain, expected) => {
    expect(suggestDomain(domain)).toBe(expected);
  });

  it('e-mail válido com provedor parecido traz sugestão sem bloquear', () => {
    const r = checkEmail('maria@gmial.com');
    expect(r.ok).toBe(true);
    expect(r.suggestion).toBe('maria@gmial.com'.replace('gmial', 'gmail'));
  });

  it('terminação inválida traz sugestão junto com o erro', () => {
    const r = checkEmail('maria@gmail.con');
    expect(r.suggestion).toBe('maria@gmail.com');
  });
});

describe('celular', () => {
  it('formata enquanto digita', () => {
    expect(formatPhone('1')).toBe('(1');
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('119')).toBe('(11) 9');
    expect(formatPhone('1198765')).toBe('(11) 9876-5');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('+55 (11) 98765-4321')).toBe('(11) 98765-4321');
    expect(formatPhone('5511987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('119876543219999')).toBe('(11) 98765-4321');
  });

  it('aceita celular válido e devolve E.164', () => {
    expect(checkPhone('(11) 99642-1873')).toEqual({ ok: true, e164: '+5511996421873' });
    expect(checkPhone('54 99123-4567')).toEqual({ ok: true, e164: '+5554991234567' });
  });

  it.each([
    ['', 'Informe'],
    ['(11) 9876', 'Faltam'],
    ['(20) 98765-4321', 'DDD 20'],
    ['(10) 98765-4321', 'DDD 10'],
    ['(11) 3456-7890', 'fixo'],
    ['(11) 8765-4321', '9 dígitos'],
    ['(11) 88765-4321', 'começam com 9'],
    ['(11) 99999-9999', 'não parece real'],
    ['(11) 91234-5678', 'não parece real'],
    ['(11) 98765-4321', 'não parece real'],
  ])('recusa "%s"', (p, part) => {
    const r = checkPhone(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(part);
  });
});

describe('nome', () => {
  it('arruma maiúsculas e espaços', () => {
    expect(formatName('  joão   DA silva ')).toBe('João da Silva');
    expect(formatName("maria d'ávila dos santos")).toBe("Maria D'Ávila dos Santos");
    expect(formatName('ana-luiza souza')).toBe('Ana-Luiza Souza');
  });

  it('aceita nome e sobrenome', () => {
    expect(checkName('maria silva')).toEqual({ ok: true, name: 'Maria Silva' });
    expect(checkName('José Ângelo Ñúñez')).toEqual({ ok: true, name: 'José Ângelo Ñúñez' });
  });

  it.each([
    ['', 'Informe'],
    ['Maria', 'sobrenome'],
    ['Maria 2 Silva', 'números'],
    ['Maria @ Silva', 'letras'],
    ['Maaaria Silva', 'repetidas'],
  ])('recusa "%s"', (n, part) => {
    const r = checkName(n);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(part);
  });

  it('limita o tamanho', () => {
    expect(checkName(`${'Ana '.repeat(25)}Silva`).ok).toBe(false);
  });
});

describe('senha', () => {
  it('marca cada regra separadamente', () => {
    const r = Object.fromEntries(passwordRules('abc').map((x) => [x.key, x.ok]));
    expect(r).toEqual({ length: false, lower: true, upper: false, digit: false, symbol: false });
    const all = passwordRules('Lanterna#42').every((x) => x.ok);
    expect(all).toBe(true);
  });

  it('aceita senha forte', () => {
    expect(checkPassword('Lanterna#42')).toEqual({ ok: true });
    expect(checkPassword('Pé-de-moleque9')).toEqual({ ok: true });
  });

  it('diz exatamente o que falta', () => {
    const r = checkPassword('lanterna');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('uma letra maiúscula');
      expect(r.error).toContain('um número');
      expect(r.error).toContain('um símbolo');
      expect(r.error).not.toContain('8 caracteres');
    }
  });

  it.each([
    ['Flamengo@2024', 'fácil de adivinhar'],
    ['Senha@123', 'fácil de adivinhar'],
    ['Brasil#2026', 'fácil de adivinhar'],
    ['Maria!2024x', 'nome ou seu e-mail'],
    ['Laaaa#9tern', 'repetir'],
    ['Lanterna#1234', 'sequências'],
    ['Qwer#Lanterna9', 'sequências'],
    [' Lanterna#42', 'espaços'],
  ])('recusa "%s"', (pw, part) => {
    const r = checkPassword(pw, { email: 'maria.silva@gmail.com', name: 'Maria Silva' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(part);
  });

  it('recusa senha longa demais', () => {
    expect(passwordProblem(`Ab1!${'x'.repeat(80)}`)).toContain('72');
  });

  it('a força sobe com as regras e o tamanho', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBeLessThanOrEqual(2);
    expect(passwordStrength('Lanterna#42')).toBe(3);
    expect(passwordStrength('Lanterna#42baiacu')).toBe(4);
    expect(passwordStrength('Flamengo@2024')).toBeLessThanOrEqual(2);
  });
});

describe('código', () => {
  it('fica só com 6 números', () => {
    expect(cleanCode(' 12a 34-56789')).toBe('123456');
  });
});
