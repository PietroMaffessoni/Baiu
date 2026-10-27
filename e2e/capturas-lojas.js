// Gera as imagens das lojas a partir da versão web de teste do app.
//
//   npm run store:images                 gera a versão web, captura as telas e monta as imagens
//   npm run store:images -- --sem-build  reaproveita a versão web já gerada (e2e/.web)
//
// As telas usam os dados de exemplo do app; bancos conectados e assinatura usam o banco e a loja de teste.
// Saída: store/imagens/app-store (1320 × 2868), store/imagens/google-play (1080 × 1920, banner e ícone)
// e store/imagens/revisao-assinatura.png, a captura da tela de assinatura que a Apple pede na revisão.
const { spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { BASE, PORT, launch, newPhone, tools } = require('./lib');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(__dirname, '.web');
const RAW = path.join(__dirname, 'capturas', 'lojas');
const OUT = path.join(ROOT, 'store', 'imagens');
const url = (p) => 'file:///' + p.replace(/\\/g, '/');

/** Ordem, arquivo, título e subtítulo de cada captura. O Google Play aceita até 8. */
const SHOTS = [
  ['inicio', 'Seu dinheiro com fôlego', 'O Baiu enche a cada bom hábito.'],
  ['bancos', 'Conecte seus bancos', 'Pelo Open Finance, tudo chega sozinho.'],
  ['assistente', 'O Baiu do seu lado', 'Tire dúvidas e veja onde economizar.'],
  ['folego', 'Entenda sua nota', 'Quatro pilares e o próximo passo, em reais.'],
  ['extrato', 'Veja para onde foi', 'O extrato do mês, dia a dia.'],
  ['vencimentos', 'Nenhum vencimento esquecido', 'Lembrete um dia antes e no dia.'],
  ['investir', 'Investimentos em dia', 'Rendimento do mês e constância de aportes.'],
  ['personalizar', 'Do seu jeito', 'Escolha a cor e veja o Baiu nas datas comemorativas.'],
];

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

function serve(root) {
  const types = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

/** Captura as telas cruas, no tamanho de um iPhone (393 × 852 pontos, 3x). */
async function captureRaw(browser) {
  fs.rmSync(RAW, { recursive: true, force: true });
  fs.mkdirSync(RAW, { recursive: true });
  const hd = { deviceScaleFactor: 3, reducedMotion: 'reduce' };

  // Dados de exemplo, navegando por dentro do app (o modo exemplo não sobrevive a recarregar a página).
  {
    const { ctx, page } = await newPhone(browser, hd);
    const t = tools(page, 'lojas');
    const shot = async (name) => {
      await t.W(1800);
      await page.screenshot({ path: path.join(RAW, name + '.png') });
    };
    const back = async () => {
      await page.goBack();
      await t.W(900);
    };
    await t.go('/');
    await t.btn('Explorar com dados de exemplo', { wait: 4500 });
    // a conversa abre pelo aviso do Baiu, que some da tela inicial depois de visto
    await t.btn('Conversar sobre isso', { wait: 1500 });
    await t.btn('Onde posso economizar?', { wait: 2000 });
    // no modo exemplo o subtítulo diz "do modo exemplo"; numa conta com a IA desligada, só "Respostas prontas"
    await page.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue === 'Respostas prontas do modo exemplo') n.nodeValue = 'Respostas prontas';
    });
    await shot('assistente');
    await back();
    await shot('inicio');
    await page.getByLabel(/^Fôlego \d+ de 100/).first().click();
    await shot('folego');
    await back();
    await t.tap('Extrato', { nth: -1, wait: 900 });
    await shot('extrato');
    await t.tap('Investir', { nth: -1, wait: 900 });
    await shot('investir');
    await t.tap('Início', { nth: -1, wait: 900 });
    await t.btn('Ajustes', { wait: 900 });
    await t.tap('Vencimentos', { nth: -1, wait: 900 });
    await shot('vencimentos');
    await back();
    await t.tap('Personalizar o Baiu', { wait: 900 });
    await page.getByRole('radio', { name: 'Turquesa', exact: true }).click();
    await t.W(400);
    await page.getByRole('button', { name: /^Natal,/ }).click();
    await shot('personalizar');
    await ctx.close();
  }

  // Conta com o banco de teste conectado.
  {
    const { ctx, page } = await newPhone(browser, hd);
    const t = tools(page, 'lojas');
    await t.signup('Helena Prado', 'helena.prado@gmail.com', '11996421873');
    await t.btn('Conecte seu banco', { wait: 1200 });
    await t.btn('Continuar', { wait: 1500 });
    await t.btn('Banco Exemplo', { wait: 700 });
    await t.field('CPF do titular da conta').fill('52998224725');
    await t.btn('Ir para o banco', { wait: 4500 });
    await page.screenshot({ path: path.join(RAW, 'bancos.png') });
    await ctx.close();
  }

  // Tela de assinatura, como aparece no iPhone para quem acabou de criar a conta, só com o plano mensal.
  {
    const { ctx, page } = await newPhone(browser, hd);
    const t = tools(page, 'lojas');
    await t.go('/');
    await page.evaluate(() => localStorage.setItem('baiu:fake-store', JSON.stringify({ subs: {}, trialUsed: {}, offered: ['mensal'] })));
    await t.signup('Helena Prado', 'helena.prado@gmail.com', '11996421873', { subscribe: false });
    await t.W(1500);
    // na loja de teste, o app escreve "loja de teste" onde o iPhone escreve "App Store"
    await page.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) n.nodeValue = n.nodeValue.replace(/loja de teste/g, 'App Store');
    });
    const text = await t.text();
    if (!text.includes('Começar meu mês grátis') || text.includes('Anual')) throw new Error('tela de assinatura inesperada: ' + text.slice(0, 300));
    await page.screenshot({ path: path.join(OUT, 'revisao-assinatura.png') });
    await ctx.close();
  }
}

const FONTS = `
@font-face { font-family: ZB; src: url('${url(path.join(ROOT, 'assets/fonts/ZenMaruGothic-900Black.ttf'))}'); }
@font-face { font-family: ZM; src: url('${url(path.join(ROOT, 'assets/fonts/ZenMaruGothic-700Bold.ttf'))}'); }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0F1A3D; overflow: hidden; }
`;

const WORDMARK = (w, tint = '#F4F0E6') => `
<svg width="${w}" height="${(w * 164) / 382}" viewBox="0 0 382 164">
  <defs><radialGradient id="d" cx="40%" cy="36%" r="62%"><stop offset="0" stop-color="#FFE3A1"/><stop offset="0.55" stop-color="#FFB648"/><stop offset="1" stop-color="#E58A2B"/></radialGradient></defs>
  <g stroke="${tint}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M11 14 V150"/><circle cx="53" cy="108" r="42"/><circle cx="173" cy="108" r="42"/><path d="M215 66 V150"/>
    <path d="M251 66 V150"/><path d="M287 66 V108 A42 42 0 0 0 371 108 V66"/><path d="M371 66 V150"/>
  </g>
  <circle cx="251" cy="20" r="16" fill="url(#d)"/>
</svg>`;

/** A captura dentro de um celular, com título e subtítulo em cima. */
function framed({ W, H, phoneW, top, title, sub, titleSize, subSize, padTop, img }) {
  const s = phoneW / 393;
  return `<html><head><style>${FONTS}
  .glow { position:absolute; left:50%; top:${top + 120 * s}px; width:${W * 1.4}px; height:${W * 1.4}px; transform:translate(-50%,-50%);
          background: radial-gradient(circle, rgba(255,182,72,0.22) 0%, rgba(255,182,72,0.06) 40%, rgba(15,26,61,0) 70%); }
  .cap { position:absolute; left:0; right:0; top:${padTop}px; text-align:center; padding:0 22px; }
  .t { font-family: ZB; color:#F4F0E6; font-size:${titleSize}px; line-height:1.15; letter-spacing:-0.3px; }
  .s { font-family: ZM; color:#A9B3D6; font-size:${subSize}px; line-height:1.35; margin-top:${subSize * 0.55}px; }
  .phone { position:absolute; left:50%; top:${top}px; width:${phoneW + 12 * s}px; transform:translateX(-50%);
           border-radius:${58 * s}px; padding:${6 * s}px; background:#25305A; box-shadow: 0 ${20 * s}px ${60 * s}px rgba(0,0,0,0.45); }
  .screen { border-radius:${52 * s}px; overflow:hidden; background:#0F1A3D; }
  .bar { height:${50 * s}px; display:flex; align-items:center; justify-content:space-between; padding:0 ${30 * s}px 0 ${38 * s}px;
         font-family: ZM; color:#F4F0E6; font-size:${16 * s}px; }
  .bat { width:${25 * s}px; height:${12 * s}px; border:${1.5 * s}px solid #F4F0E6; border-radius:${3.5 * s}px; padding:${1.5 * s}px; opacity:0.9 }
  .bat i { display:block; height:100%; width:80%; background:#F4F0E6; border-radius:${1.5 * s}px; }
  .screen img { display:block; width:${phoneW}px; }
  </style></head><body style="width:${W}px;height:${H}px;position:relative">
  <div class="glow"></div>
  <div class="cap"><div class="t">${title}</div><div class="s">${sub}</div></div>
  <div class="phone"><div class="screen"><div class="bar"><span>9:41</span><span class="bat"><i></i></span></div>
  <img src="${url(path.join(RAW, img + '.png'))}"></div></div>
  </body></html>`;
}

async function compose(browser) {
  for (const dir of ['app-store', 'google-play']) {
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    for (const f of fs.readdirSync(path.join(OUT, dir))) if (/^\d\d-.*\.jpg$/.test(f)) fs.rmSync(path.join(OUT, dir, f));
  }
  const tmp = path.join(RAW, '_quadro.html');
  const render = async (html, w, h, dpr, file, type = 'jpeg') => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    fs.writeFileSync(tmp, '<meta charset="utf-8">' + html);
    await page.goto(url(tmp));
    await page.waitForTimeout(500);
    await page.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 92 } : {}) });
    await ctx.close();
  };
  let i = 0;
  for (const [img, title, sub] of SHOTS) {
    const n = String(++i).padStart(2, '0');
    // App Store, iPhone de 6,9 polegadas: 1320 × 2868
    await render(framed({ W: 440, H: 956, phoneW: 340, top: 190, title, sub, titleSize: 34, subSize: 18, padTop: 62, img }), 440, 956, 3, path.join(OUT, 'app-store', `${n}-${img}.jpg`));
    // Google Play, celular 9:16: 1080 × 1920
    await render(framed({ W: 360, H: 640, phoneW: 250, top: 140, title, sub, titleSize: 26, subSize: 14.5, padTop: 40, img }), 360, 640, 3, path.join(OUT, 'google-play', `${n}-${img}.jpg`));
  }
  // Gráfico de destaque do Google Play: 1024 × 500, com o Baiu e o brilho
  const fish = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'arte', 'fish-halo.png')).toString('base64');
  const fishW = 330;
  await render(`<html><head><style>${FONTS}
    .f { position:absolute; left:${770 - fishW}px; top:${262 - fishW}px; width:${fishW * 2}px; height:${fishW * 2}px; }
    .l { position:absolute; left:72px; top:118px; }
    .t { font-family: ZB; color:#F4F0E6; font-size:50px; line-height:1.08; margin-top:34px; letter-spacing:-0.5px; }
    .s { font-family: ZM; color:#A9B3D6; font-size:21px; margin-top:16px; }
  </style></head><body style="width:1024px;height:500px;position:relative">
    <img class="f" src="${fish}">
    <div class="l">${WORDMARK(170)}<div class="t">Seu dinheiro<br>com fôlego</div><div class="s">Finanças pessoais, privadas e sem planilha.</div></div>
  </body></html>`, 1024, 500, 1, path.join(OUT, 'google-play', 'banner-1024x500.jpg'));
  // Ícone do Google Play: 512 × 512
  await render(`<html><head><style>${FONTS}</style></head><body style="width:512px;height:512px"><img src="${url(path.join(ROOT, 'assets/images/icon.png'))}" style="width:512px;height:512px;display:block"></body></html>`, 512, 512, 1, path.join(OUT, 'google-play', 'icone-512.png'), 'png');
  fs.rmSync(tmp, { force: true });
}

(async () => {
  const args = process.argv.slice(2);
  if (!args.includes('--sem-build') || !fs.existsSync(path.join(WEB, 'index.html'))) build();
  const server = await serve(WEB);
  const browser = await launch();
  try {
    if (!args.includes('--so-montar')) await captureRaw(browser);
    await compose(browser);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`Imagens prontas em ${path.relative(ROOT, OUT)} (base ${BASE}).`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
