// Teste de carga (k6): muitas pessoas usando os bancos conectados ao mesmo tempo.
//
// Cada usuário virtual é uma pessoa com dois bancos conectados que abre o app
// (o app atualiza os bancos ao abrir), às vezes abre o histórico de
// autorizações ou a lista de bancos, e espera alguns segundos entre uma coisa
// e outra. No início, uma rajada abre a tela de conectar banco ao mesmo
// tempo: é a lista que todo mundo pede igual.
//
// Rodar pelo carga/rodar.mjs (sobe o servidor local e o k6 juntos):
//   npm run test:carga            100 e depois 1000 pessoas
//   npm run test:carga -- 1000    só 1000
// Direto, contra outro endereço (nunca contra produção sem combinar):
//   k6 run -e ALVO=100 -e URL=http://localhost:54321 carga/usuarios.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const ALVO = Number(__ENV.ALVO || 100);
const URL = (__ENV.URL || 'http://localhost:54321').replace(/\/$/, '');
/** Tempo máximo aceitável de resposta. Acima disso o servidor também dispara o alerta. */
const LIMITE_MS = Number(__ENV.LIMITE_MS || 1000);

export const options = {
  scenarios: {
    rajada: {
      executor: 'per-vu-iterations',
      exec: 'rajada',
      vus: Math.max(10, ALVO / 10),
      iterations: 1,
      maxDuration: '30s',
    },
    pessoas: {
      executor: 'ramping-vus',
      exec: 'pessoa',
      startVUs: 0,
      stages: [
        { duration: '20s', target: ALVO },
        { duration: '40s', target: ALVO },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    // Atualizar passa por três etapas da Polp, uma depois da outra (autorização,
    // contas, movimentos): é o piso, e corre por trás, com os dados do aparelho
    // já na tela. A metade tem de ficar abaixo do limite, e quase todas abaixo
    // do dobro. Acima de 1 s o servidor avisa do mesmo jeito.
    'http_req_duration{acao:sync}': [`med<${LIMITE_MS}`, `p(95)<${LIMITE_MS * 2}`],
    // primeira vez: todo o histórico, página por página
    'http_req_duration{acao:primeira}': [`p(95)<${LIMITE_MS * 3}`],
    'http_req_duration{acao:historico}': [`p(95)<${LIMITE_MS}`],
    'http_req_duration{acao:bancos}': [`p(95)<${LIMITE_MS}`],
    // só para o resumo contar os pedidos de cada ação
    'http_reqs{acao:sync}': ['count>=0'],
    'http_reqs{acao:primeira}': ['count>=0'],
    'http_reqs{acao:historico}': ['count>=0'],
    'http_reqs{acao:bancos}': ['count>=0'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
};

const call = (vu, action, body = {}) => {
  const res = http.post(`${URL}/functions/v1/bank`, JSON.stringify({ action, ...body }), {
    headers: { Authorization: `Bearer carga-${vu}`, apikey: 'anon', 'Content-Type': 'application/json' },
    tags: {
      acao:
        action === 'sync' && !body.since?.[`c${vu}-1`]
          ? 'primeira'
          : action === 'institutions'
            ? 'bancos'
            : action === 'history'
              ? 'historico'
              : action,
    },
    timeout: '30s',
  });
  check(res, { 'respondeu 200': (r) => r.status === 200 });
  return res;
};

export function rajada() {
  // ids altos para não misturar com as pessoas do outro cenário
  call(100_000 + __VU, 'institutions');
}

export function pessoa() {
  const vu = __VU;
  const recente = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const r = Math.random();
  if (__ITER === 0 && vu % 20 === 0) {
    // primeira vez: busca tudo, inclusive investimentos
    call(vu, 'sync', { since: {} });
  } else {
    call(vu, 'sync', { since: { [`c${vu}-1`]: recente, [`c${vu}-2`]: recente } });
  }
  sleep(2 + Math.random() * 3);
  if (r < 0.1) call(vu, 'history');
  else if (r < 0.15) call(vu, 'institutions');
  sleep(1 + Math.random() * 2);
}

const ms = (v) => (v === undefined ? '-' : `${Math.round(v)} ms`);

export function handleSummary(data) {
  const lines = [`\n${ALVO} pessoas ao mesmo tempo, limite ${LIMITE_MS} ms`, ''];
  lines.push('ação         pedidos   mediana      p95      p99      máx');
  for (const acao of ['sync', 'primeira', 'historico', 'bancos']) {
    const m = data.metrics[`http_req_duration{acao:${acao}}`];
    if (!m || !m.values) continue;
    const reqs = data.metrics[`http_reqs{acao:${acao}}`]?.values.count;
    const v = m.values;
    lines.push(
      `${acao.padEnd(12)} ${String(reqs ?? '').padStart(7)} ${ms(v.med).padStart(9)} ${ms(v['p(95)']).padStart(8)} ${ms(v['p(99)']).padStart(8)} ${ms(v.max).padStart(8)}`,
    );
  }
  const failed = data.metrics.http_req_failed?.values.rate ?? 0;
  lines.push(
    '',
    `falhas: ${(failed * 100).toFixed(2)}%   pedidos por segundo: ${Math.round(data.metrics.http_reqs?.values.rate ?? 0)}`,
  );
  const broken = Object.entries(data.metrics)
    .filter(([, m]) => m.thresholds && Object.values(m.thresholds).some((t) => !t.ok))
    .map(([k]) => k);
  lines.push(broken.length ? `PASSOU DO LIMITE: ${broken.join(', ')}` : 'dentro do limite em tudo', '');
  const out = { stdout: lines.join('\n') };
  if (__ENV.RESULTADO) out[__ENV.RESULTADO] = JSON.stringify(data, null, 2);
  return out;
}
