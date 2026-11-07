// Sobe o servidor local de carga (carga/servidor.mjs), roda o k6 com 100 e
// com 1000 pessoas e mostra, além dos tempos, quantas chamadas cada serviço de
// fora recebeu. Um servidor novo por rodada, para o cache começar vazio.
//
//   npm run test:carga             100 e 1000
//   npm run test:carga -- 1000     só uma rodada
// Precisa do k6 (https://grafana.com/docs/k6/latest/set-up/install-k6/;
// no Windows: winget install k6). Outro caminho: variável K6.
// Sai com erro se alguma rodada passar do limite (1 s, ou LIMITE_MS).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer } from './servidor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const alvos = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => n > 0);
const k6 = process.env.K6 || 'k6';
const out = join(here, 'resultados');
mkdirSync(out, { recursive: true });

let ok = true;
for (const alvo of alvos.length ? alvos : [100, 1000]) {
  const { server, world, port } = await startServer();
  const code = await new Promise((resolve) => {
    const p = spawn(
      k6,
      [
        'run',
        '--quiet',
        '-e',
        `ALVO=${alvo}`,
        '-e',
        `URL=http://localhost:${port}`,
        '-e',
        `RESULTADO=${join(out, `${alvo}.json`)}`,
        join(here, 'usuarios.js'),
      ],
      { stdio: 'inherit', env: { ...process.env, K6_NO_USAGE_REPORT: 'true' } },
    );
    p.on('error', (e) => {
      console.error(
        e.code === 'ENOENT' ? 'k6 não encontrado. Instale (winget install k6) ou aponte a variável K6.' : e,
      );
      resolve(1);
    });
    p.on('exit', resolve);
  });
  const r = world.report();
  console.log(`serviços de fora durante as ${alvo} pessoas (${r.segundos} s):`);
  console.log('serviço               chamadas  por seg  pico simultâneas  média    máx');
  for (const [name, s] of Object.entries(r.servicos)) {
    console.log(
      `${name.padEnd(21)} ${String(s.chamadas).padStart(8)} ${String(s.porSegundo).padStart(8)} ${String(s.picoSimultaneas).padStart(17)} ${`${s.mediaMs} ms`.padStart(7)} ${`${s.maxMs} ms`.padStart(7)}`,
    );
  }
  console.log(
    `respostas acima do limite (linhas "lento" no log): ${r.lentasNoLog}; avisos enviados ao webhook: ${r.alertas} (no máximo um por ação a cada 5 min)`,
  );
  for (const a of r.exemplosDeAlerta) console.log(`  ${a}`);
  console.log('');
  server.closeAllConnections();
  server.close();
  if (code !== 0) ok = false;
}
process.exit(ok ? 0 : 1);
