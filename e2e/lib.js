// Peças comuns dos roteiros de navegador: abre o navegador, navega e confere o texto da tela.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.BAIU_E2E_PORT || 8099);
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(__dirname, 'capturas');
/** Código de confirmação do servidor falso (EXPO_PUBLIC_AUTH_FAKE=1). */
const CODE = '246810';
const PASSWORD = 'Mar-Azul#5150';

/** Edge ou Chrome já instalados; BAIU_BROWSER escolhe outro. */
function browserPath() {
  const candidates = [
    process.env.BAIU_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Nenhum Chrome ou Edge encontrado. Indique o caminho em BAIU_BROWSER.');
  return found;
}

const launch = () => chromium.launch({ executablePath: browserPath(), headless: !process.env.BAIU_E2E_HEADED });

const phone = { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' };

/** Troca o espaço fino dos valores em reais por espaço comum, para comparar texto. */
const plain = (s) => s.replace(/\u00a0|\u202f/g, ' ');

/**
 * Ferramentas de um roteiro. Cada roteiro recebe uma aba nova, com o armazenamento
 * do navegador vazio, e devolve a lista de passos com OK, FALHA ou ERRO.
 */
function tools(page, suite, pace = {}) {
  const goWait = pace.go ?? 1500;
  const btnWait = pace.btn ?? 600;
  const results = [];
  let shotN = 0;

  const W = (ms = 500) => page.waitForTimeout(ms);
  const text = async () => plain(await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
  const shot = async (name) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const file = `${suite}-${String(++shotN).padStart(2, '0')}-${name.replace(/[^\w\- ]/g, '').slice(0, 40).trim()}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
  };
  const go = async (p) => {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await W(goWait);
  };
  /** Toca num elemento pelo papel de acessibilidade (botão, por padrão) e nome. */
  const btn = async (name, o = {}) => {
    await page.getByRole(o.role ?? 'button', { name, exact: o.exact ?? true }).nth(o.nth ?? 0).click({ timeout: o.timeout ?? 6000 });
    await W(o.wait ?? btnWait);
  };
  /** Toca num texto visível. */
  const tap = async (label, o = {}) => {
    await page.getByText(label, { exact: o.exact ?? true }).nth(o.nth ?? 0).click({ timeout: 6000 });
    await W(o.wait ?? 500);
  };
  const radio = (name, nth = 0) => btn(name, { role: 'radio', nth });
  const field = (label) => page.getByLabel(label, { exact: true }).first();
  const fill = async (label, value, blur = true) => {
    await field(label).fill(value);
    if (blur) await field(label).blur();
    await W(200);
  };
  const typeIn = async (label, value) => {
    await field(label).click();
    await field(label).pressSequentially(value, { delay: 20 });
    await W(200);
  };
  /** Digita no teclado numérico do app. */
  const keys = async (digits) => {
    for (const k of digits) await btn(k, { wait: 60 });
  };

  /**
   * Um passo: roda a ação e confere o que a tela mostra. A ação pode devolver
   * false para marcar falha. `expect` tem de aparecer; `absent` não pode aparecer.
   */
  const step = async (name, fn, expect = [], absent = []) => {
    try {
      const r = await fn();
      const tx = await text();
      const miss = expect.map(plain).filter((e) => !tx.includes(e));
      const extra = absent.map(plain).filter((e) => tx.includes(e));
      const bad = r === false || miss.length || extra.length;
      results.push(
        `${bad ? 'FALHA' : 'OK   '} ${name}${miss.length ? ' — faltou: ' + miss.join(' / ') : ''}${extra.length ? ' — não devia ter: ' + extra.join(' / ') : ''}`,
      );
      if (bad) {
        results.push('      tela: ' + tx.slice(0, 1200));
        await shot(name + '-falha');
      } else if (process.env.BAIU_E2E_SHOTS) await shot(name);
    } catch (e) {
      results.push(`ERRO  ${name}: ${e.message.split('\n')[0]}`);
      results.push('      tela: ' + (await text().catch(() => '')).slice(0, 900));
      await shot(name + '-erro').catch(() => {});
    }
  };

  /** Depois do cadastro, a conta nova começa o mês grátis na loja de teste. */
  const passPaywall = async () => {
    await W(2600);
    const b = page.getByRole('button', { name: 'Começar meu mês grátis', exact: true });
    if (await b.count()) {
      await b.first().click();
      await W(3000);
    }
  };
  /** Cria uma conta pelo app com o servidor falso. `subscribe: false` para parar na tela de assinatura. */
  const signup = async (name, email, phoneNumber, o = {}) => {
    await go('/cadastro');
    await field('Nome completo').fill(name);
    await field('E-mail').fill(email);
    await field('Celular com DDD').pressSequentially(phoneNumber);
    await field('Senha').fill(o.password ?? PASSWORD);
    await page.getByRole('checkbox', { name: 'Li e aceito os Termos de uso e a Política de privacidade' }).click();
    await page.getByRole('checkbox', { name: 'Tenho 18 anos ou mais' }).click();
    await btn('Criar conta', { wait: 1500 });
    await field('Código de confirmação').fill(CODE);
    if (o.subscribe === false) await W(3200);
    else await passPaywall();
  };
  const signOut = async () => {
    await go('/minha-conta');
    await btn('Sair da conta', { wait: 1500 });
  };

  return { page, results, W, text, shot, go, btn, tap, radio, field, fill, typeIn, keys, step, passPaywall, signup, signOut, BASE, CODE, PASSWORD };
}

/** Abre uma aba de celular e junta os erros do console. */
async function newPhone(browser, extra = {}) {
  const ctx = await browser.newContext({ ...phone, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300));
  });
  page.on('dialog', (d) => {
    errors.push('DIALOG ' + d.message());
    d.accept();
  });
  return { ctx, page, errors };
}

module.exports = { BASE, PORT, CODE, PASSWORD, launch, newPhone, tools, plain, phone };
