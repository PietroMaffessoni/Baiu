// Roda os roteiros de navegador contra a versão web do app, com servidor, banco, IA e loja falsos.
//
//   npm run test:e2e                       gera a versão web e roda todos os roteiros
//   npm run test:e2e -- bancos assinatura  roda só esses
//   npm run test:e2e -- --sem-build        reaproveita a versão web já gerada
//
// BAIU_E2E_SHOTS=1 guarda uma captura de cada passo em e2e/capturas/ (as falhas são guardadas sempre).
// BAIU_E2E_HEADED=1 mostra o navegador.
const { spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { PORT, launch, newPhone, tools } = require('./lib');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(__dirname, '.web');
const SUITES = ['apresentacao', 'fluxo', 'cadastro', 'bancos', 'assistente', 'assinatura', 'personalizar', 'telas-pequenas'];

/** Gera a versão web com os serviços falsos (EXPO_PUBLIC_AUTH_FAKE=1). */
function build() {
  console.log('Gerando a versão web de teste...');
  const r = spawnSync(`npx expo export --platform web --output-dir "${WEB}" --clear`, {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: true,
    env: { ...process.env, EXPO_PUBLIC_AUTH_FAKE: '1', CI: '1' },
  });
  if (r.status !== 0) throw new Error('expo export falhou');
}

const TYPES = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.json': 'application/json' };

/** Servidor estático; rotas desconhecidas devolvem o index.html, como no app de página única. */
function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

(async () => {
  const args = process.argv.slice(2);
  const chosen = args.filter((a) => !a.startsWith('--'));
  const unknown = chosen.filter((s) => !SUITES.includes(s));
  if (unknown.length) {
    console.error(`Roteiro desconhecido: ${unknown.join(', ')}. Existem: ${SUITES.join(', ')}.`);
    process.exit(2);
  }
  if (!args.includes('--sem-build') || !fs.existsSync(path.join(WEB, 'index.html'))) build();

  const server = await serve(WEB);
  const browser = await launch();
  let failed = 0;
  let total = 0;
  try {
    for (const name of chosen.length ? chosen : SUITES) {
      const suite = require(`./roteiros/${name}`);
      const started = Date.now();
      console.log(`\n== ${name}`);
      if (suite.custom) {
        // roteiro que abre as próprias abas (por exemplo, em vários tamanhos de tela)
        const results = await suite(browser);
        results.forEach((l) => console.log(l));
        total += results.filter((l) => /^(OK|FALHA|ERRO)/.test(l)).length;
        failed += results.filter((l) => /^(FALHA|ERRO)/.test(l)).length;
        continue;
      }
      const { ctx, page, errors } = await newPhone(browser, suite.context);
      const t = tools(page, name, suite.pace);
      await suite(t);
      await ctx.close();
      t.results.forEach((l) => console.log(l));
      const crashes = [...new Set(errors.filter((e) => e.startsWith('PAGEERROR')))];
      crashes.forEach((e) => t.results.push('ERRO  ' + e));
      if (crashes.length) crashes.forEach((e) => console.log('ERRO  ' + e));
      const others = [...new Set(errors.filter((e) => !e.startsWith('PAGEERROR')))];
      if (others.length) console.log('  avisos do navegador:\n    ' + others.join('\n    '));
      total += t.results.filter((l) => /^(OK|FALHA|ERRO)/.test(l)).length;
      failed += t.results.filter((l) => /^(FALHA|ERRO)/.test(l)).length;
      console.log(`  (${Math.round((Date.now() - started) / 1000)} s)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\n${total - failed} de ${total} passos certos.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
