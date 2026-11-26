import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { db } from './db/db.js';
import { notifyAdmin } from './notify/notify.js';

// The daily pipeline, in order. Each step only processes what is new or changed.
const STEPS = [
  { name: 'Index course content (SharePoint)', script: 'src/index-content.js' },
  { name: 'Collect vendor news',              script: 'src/news/collect.js' },
  { name: 'Triage new posts (AI)',            script: 'src/ai/triage.js' },
  { name: 'Judge relevant posts (AI)',        script: 'src/ai/judge.js' },
  { name: 'Notifications',                    script: 'src/notify/notify.js' },
];

const totalSpend = () => db.prepare('SELECT COALESCE(SUM(costUsd), 0) AS s FROM ai_usage').get().s;
const started = new Date();
const spendBefore = totalSpend();
const results = [];

console.log(`=== Course Freshness Radar daily run – ${started.toLocaleString('en-IN')} ===`);

for (const step of STEPS) {
  console.log(`\n▶ ${step.name}`);
  const t0 = Date.now();
  // Each step runs as its own process: if one crashes, the others still run
  const r = spawnSync(process.execPath, ['--experimental-sqlite', '--no-warnings', step.script], {
    stdio: 'inherit',
    env: process.env,
  });
  const ok = r.status === 0;
  const seconds = Math.round((Date.now() - t0) / 1000);
  results.push({ step: step.name, ok, seconds, code: r.status });
  console.log(`${ok ? '✅' : '❌'} ${step.name} (${seconds}s)`);
}

// ---- Summary ----
const failed = results.filter((r) => !r.ok);
const aiCost = totalSpend() - spendBefore;
const newFlags = db.prepare('SELECT COUNT(*) AS n FROM flags WHERE isSample = 0 AND createdAt >= ?')
                   .get(started.toISOString()).n;
const openFlags = db.prepare(`SELECT COUNT(*) AS n FROM flags WHERE isSample = 0 AND status IN ('New', 'Accepted')`).get().n;
const minutes = ((Date.now() - started.getTime()) / 60000).toFixed(1);

db.prepare(`
  INSERT INTO runs (startedAt, finishedAt, status, steps, newFlags, openFlags, aiCost)
  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  started.toISOString(), new Date().toISOString(), failed.length ? 'failed' : 'ok',
  JSON.stringify(results), newFlags, openFlags, aiCost);

console.log(`\n=== Done in ${minutes} min · ${failed.length ? `${failed.length} step(s) FAILED` : 'all steps OK'} ===`);
console.log(`New flags: ${newFlags} · Open flags: ${openFlags} · AI cost this run: $${aiCost.toFixed(4)}`);

// Tell the admin if anything went wrong
if (failed.length) {
  await notifyAdmin(`Daily run: ${failed.length} step(s) failed`, [
    ...failed.map((f) => `${f.step} (exit code ${f.code})`),
    'The other steps still ran. Check the run log on the machine running the tool.',
  ]);
}

process.exit(failed.length ? 1 : 0);