// Gera src/content/licencas.json: cada biblioteca que entra no app, com a
// licença e o aviso de direitos autorais, que as licenças MIT, BSD, ISC e
// Apache pedem que acompanhem o app. A lista sai do pacote do Android de
// verdade (o mapa do código), não do package.json.
// Rodar depois de instalar ou trocar dependências: node scripts/build-licenses.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'baiu-licencas-'));

execSync(`npx expo export --platform android --source-maps --output-dir "${out}"`, { cwd: root, stdio: 'inherit' });

const maps = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.map')) maps.push(p);
  }
};
walk(out);

const names = new Set();
for (const m of maps) {
  for (const s of JSON.parse(fs.readFileSync(m, 'utf8')).sources) {
    const i = s.lastIndexOf('node_modules/');
    if (i < 0) continue;
    const parts = s.slice(i + 'node_modules/'.length).split('/');
    names.add(parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]);
  }
}
fs.rmSync(out, { recursive: true, force: true });

// ferramentas de desenvolvimento que o Metro cita no mapa, mas só rodam no computador
const DEV_ONLY = new Set(['@expo/cli', '@expo/metro', '@expo/log-box-utils']);

// pacotes publicados sem o arquivo da licença: vale o do projeto de onde saem
const SAME_PROJECT = [
  [/^@react-native\/|^metro-runtime$/, 'react-native'],
  [/^expo-router$/, 'expo'],
  [/^@revenuecat\//, 'react-native-purchases'],
];

const MIT = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const licenseFile = (dir) => {
  const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  return file ? fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n').trim() : '';
};

const packages = [];
for (const name of [...names].sort()) {
  if (DEV_ONLY.has(name)) continue;
  const dir = path.join(root, 'node_modules', name);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'ver o pacote');
  const parent = SAME_PROJECT.find(([re]) => re.test(name))?.[1];
  const author = typeof pkg.author === 'string' ? pkg.author.replace(/\s*<.*$/, '') : pkg.author?.name;
  const text =
    licenseFile(dir) ||
    (parent ? licenseFile(path.join(root, 'node_modules', parent)) : '') ||
    (license === 'MIT' && author ? MIT(author) : '');
  if (!text) throw new Error(`${name}: sem o texto da licença. Ache no repositório do pacote e acrescente aqui.`);
  if (/GPL|AGPL|LGPL|SSPL|EUPL/.test(license) && !/ OR /.test(license)) {
    throw new Error(`${name} usa ${license}: confira antes de publicar`);
  }
  packages.push({ name, version: pkg.version, license, text });
}

const font = {
  name: 'Zen Maru Gothic',
  license: 'OFL-1.1',
  text: fs.readFileSync(path.join(root, 'assets/fonts/OFL.txt'), 'utf8').replace(/\r\n/g, '\n').trim(),
};

fs.writeFileSync(path.join(root, 'src/content/licencas.json'), JSON.stringify({ fonts: [font], packages }, null, 1) + '\n');
console.log(`src/content/licencas.json: ${packages.length} bibliotecas e 1 fonte`);
