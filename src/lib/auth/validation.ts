import { COMMON_PASSWORDS, DISPOSABLE_DOMAINS, POPULAR_DOMAINS } from './lists';

/**
 * Regras do cadastro e do login. Tudo aqui roda no aparelho, sem rede, e as
 * mesmas regras de nome, celular e senha são conferidas de novo no servidor.
 */

// ---------- e-mail ----------

/** Tira espaços e deixa em minúsculas, como os provedores tratam o endereço. */
export function normalizeEmail(raw: string) {
  return raw.replace(/\s+/g, '').toLowerCase();
}

const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export type EmailCheck =
  | { ok: true; email: string; suggestion?: string }
  | { ok: false; email: string; error: string; suggestion?: string };

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[a.length][b.length];
}

/** Domínio conhecido mais parecido com o digitado, quando parece erro de digitação. */
export function suggestDomain(domain: string): string | undefined {
  if (!domain || POPULAR_DOMAINS.includes(domain)) return undefined;
  // "gmail.com.br" e "icloud.com.br" não existem
  if (domain.endsWith('.com.br')) {
    const intl = domain.replace(/\.br$/, '');
    if (POPULAR_DOMAINS.includes(intl)) return intl;
  }
  let best: string | undefined;
  let bestD = Infinity;
  for (const known of POPULAR_DOMAINS) {
    const d = distance(domain, known);
    if (d < bestD) {
      bestD = d;
      best = known;
    }
  }
  // "gmail.co", "gmial.com", "hotmial.com", "gmail.com.br"
  const limit = domain.length <= 8 ? 1 : 2;
  if (best && bestD <= limit) return best;
  // terminações trocadas: ".con", ".cm", ".comm", ".combr"
  const fixedTld = domain.replace(/\.(con|cm|cpm|comm|om|vom|xom)$/, '.com').replace(/\.combr$/, '.com.br');
  if (fixedTld !== domain) return fixedTld;
  return undefined;
}

export function checkEmail(raw: string): EmailCheck {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, email, error: 'Informe seu e-mail.' };
  const at = email.lastIndexOf('@');
  if (at < 1 || email.indexOf('@') !== at) {
    return { ok: false, email, error: 'O e-mail precisa ter um @, como nome@gmail.com.' };
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain) return { ok: false, email, error: 'Falta o provedor depois do @, como gmail.com.' };
  if (email.length > 254 || local.length > 64) return { ok: false, email, error: 'Este e-mail é longo demais.' };
  if (!LOCAL.test(local)) {
    return { ok: false, email, error: 'A parte antes do @ tem caracteres que não valem em e-mail.' };
  }
  const labels = domain.split('.');
  const tld = labels[labels.length - 1];
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !/^[a-z]{2,24}$/.test(tld)) {
    const suggestion = suggestDomain(domain);
    return {
      ok: false,
      email,
      error: 'O provedor depois do @ não parece válido.',
      suggestion: suggestion ? `${local}@${suggestion}` : undefined,
    };
  }
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, email, error: 'E-mails temporários não são aceitos. Use um e-mail que você acessa sempre.' };
  }
  const suggestion = suggestDomain(domain);
  return { ok: true, email, suggestion: suggestion ? `${local}@${suggestion}` : undefined };
}

// ---------- celular ----------

/** DDDs em uso no Brasil (Anatel). */
export const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Só os dígitos nacionais (DDD + número), sem o +55. */
export function phoneDigits(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length > 11 && d.startsWith('0')) d = d.replace(/^0+/, '');
  return d.slice(0, 11);
}

/** Máscara enquanto digita: (11) 98765-4321. */
export function formatPhone(raw: string) {
  const d = phoneDigits(raw);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export type PhoneCheck = { ok: true; e164: string } | { ok: false; error: string };

export function checkPhone(raw: string): PhoneCheck {
  const d = phoneDigits(raw);
  if (d.length === 0) return { ok: false, error: 'Informe seu celular com DDD.' };
  if (d.length < 10) return { ok: false, error: 'Faltam números. Use o DDD e os 9 dígitos do celular.' };
  const ddd = Number(d.slice(0, 2));
  if (!DDDS.has(ddd)) return { ok: false, error: `O DDD ${d.slice(0, 2)} não existe no Brasil.` };
  const local = d.slice(2);
  if (local.length === 8) {
    return /^[2-5]/.test(local)
      ? { ok: false, error: 'Este parece um telefone fixo. Informe um celular.' }
      : { ok: false, error: 'Celulares têm 9 dígitos depois do DDD, começando com 9.' };
  }
  if (local[0] !== '9') return { ok: false, error: 'Celulares começam com 9 depois do DDD.' };
  const rest = local.slice(1);
  if (/^(\d)\1+$/.test(rest) || rest === '12345678' || rest === '87654321') {
    return { ok: false, error: 'Este número não parece real. Confira os dígitos.' };
  }
  return { ok: true, e164: `+55${d}` };
}

// ---------- nome ----------

const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von', 'del', 'la']);

/** "joão  DA silva" vira "João da Silva". */
export function formatName(raw: string) {
  const words = raw.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('pt-BR');
      if (i > 0 && PARTICLES.has(lower)) return lower;
      return lower
        .split(/([-'’])/)
        .map((part) => (part.length > 0 && !/[-'’]/.test(part) ? part[0].toLocaleUpperCase('pt-BR') + part.slice(1) : part))
        .join('');
    })
    .join(' ');
}

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

export function checkName(raw: string): NameCheck {
  const name = formatName(raw);
  if (!name) return { ok: false, error: 'Informe seu nome completo.' };
  if (/\d/.test(name)) return { ok: false, error: 'O nome não pode ter números.' };
  if (!/^[\p{L}\p{M}' ’-]+$/u.test(name)) return { ok: false, error: 'Use só letras no nome.' };
  const words = name.split(' ');
  if (words.length < 2) return { ok: false, error: 'Informe nome e sobrenome.' };
  if (words.some((w) => w.replace(/[-'’]/g, '').length === 0)) return { ok: false, error: 'Confira o nome digitado.' };
  if (name.length > 80) return { ok: false, error: 'Use no máximo 80 letras.' };
  if (/(\p{L})\1\1/u.test(name.toLocaleLowerCase('pt-BR'))) {
    return { ok: false, error: 'O nome tem letras repetidas demais. Confira o que foi digitado.' };
  }
  return { ok: true, name };
}

// ---------- senha ----------

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export type PasswordRule = { key: string; label: string; ok: boolean };

/** Regras sempre visíveis, marcadas conforme a pessoa digita. */
export function passwordRules(pw: string): PasswordRule[] {
  return [
    { key: 'length', label: `Pelo menos ${PASSWORD_MIN} caracteres`, ok: pw.length >= PASSWORD_MIN },
    { key: 'lower', label: 'Uma letra minúscula', ok: /\p{Ll}/u.test(pw) },
    { key: 'upper', label: 'Uma letra maiúscula', ok: /\p{Lu}/u.test(pw) },
    { key: 'digit', label: 'Um número', ok: /\d/.test(pw) },
    { key: 'symbol', label: 'Um símbolo, como ! @ # $ ?', ok: /[^\p{L}\p{N}\s]/u.test(pw) },
  ];
}

const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function hasSequence(pw: string) {
  const s = pw.toLowerCase();
  for (const seq of SEQUENCES) {
    for (let i = 0; i + 4 <= seq.length; i++) {
      const part = seq.slice(i, i + 4);
      if (s.includes(part) || s.includes([...part].reverse().join(''))) return true;
    }
  }
  return false;
}

function strip(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Problemas que só aparecem quando acontecem: senha comum, dados pessoais,
 * sequências e repetições. Retorna a primeira mensagem, ou null.
 */
export function passwordProblem(pw: string, personal: { email?: string; name?: string } = {}): string | null {
  if (pw.length > PASSWORD_MAX) return `Use no máximo ${PASSWORD_MAX} caracteres.`;
  if (/^\s|\s$/.test(pw)) return 'Tire os espaços do começo e do fim da senha.';
  const lower = strip(pw);
  const letters = lower.replace(/[^a-z]/g, '');
  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(lower.replace(/[^a-z0-9]/g, '')) || COMMON_PASSWORDS.has(letters)) {
    return 'Essa senha é fácil de adivinhar. Evite nomes, times e palavras comuns.';
  }
  const pieces: string[] = [];
  const local = personal.email ? strip(personal.email.split('@')[0]).replace(/[^a-z0-9]/g, '') : '';
  if (local.length >= 3) pieces.push(local);
  for (const w of strip(personal.name ?? '').split(/\s+/)) if (w.length >= 3 && !PARTICLES.has(w)) pieces.push(w);
  if (pieces.some((p) => lower.includes(p))) return 'Não use seu nome ou seu e-mail na senha.';
  if (/(.)\1\1\1/.test(pw)) return 'Evite repetir o mesmo caractere várias vezes seguidas.';
  if (hasSequence(pw)) return 'Evite sequências como 1234, abcd ou qwer.';
  return null;
}

export type PasswordCheck = { ok: true } | { ok: false; error: string };

export function checkPassword(pw: string, personal: { email?: string; name?: string } = {}): PasswordCheck {
  if (!pw) return { ok: false, error: 'Crie uma senha.' };
  const missing = passwordRules(pw).filter((r) => !r.ok);
  if (missing.length) return { ok: false, error: `Falta: ${missing.map((r) => r.label.toLowerCase()).join(', ')}.` };
  const problem = passwordProblem(pw, personal);
  return problem ? { ok: false, error: problem } : { ok: true };
}

/** 0 a 4, para a barra de força. */
export function passwordStrength(pw: string, personal: { email?: string; name?: string } = {}) {
  if (!pw) return 0;
  const passed = passwordRules(pw).filter((r) => r.ok).length;
  if (passed < 5 || passwordProblem(pw, personal)) return Math.min(2, Math.floor(passed / 2));
  return pw.length >= 12 ? 4 : 3;
}

export const STRENGTH_LABEL = ['', 'Fraca', 'Fraca', 'Boa', 'Forte'];

// ---------- código de verificação ----------

export const OTP_LENGTH = 6;

export function cleanCode(raw: string) {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}
