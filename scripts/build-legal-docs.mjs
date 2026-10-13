// Gera docs/privacidade.md e docs/termos.md a partir de src/content/legal.json,
// o mesmo texto que o app mostra. Rodar: node scripts/build-legal-docs.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const legal = JSON.parse(fs.readFileSync(path.join(root, 'src/content/legal.json'), 'utf8'));

function render(doc) {
  const out = [`# ${doc.title} do Baiu`, '', `Atualizada em ${legal.updated}.`, '', doc.intro, ''];
  for (const s of doc.sections) {
    out.push(`## ${s.heading}`, '');
    for (const p of s.body) out.push(p, '');
  }
  return out.join('\n');
}

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/privacidade.md'), render(legal.privacy));
fs.writeFileSync(path.join(root, 'docs/termos.md'), render(legal.terms));
console.log('docs/privacidade.md e docs/termos.md gerados');
