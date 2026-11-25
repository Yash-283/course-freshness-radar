import { db } from '../db/db.js';
import { askJson, MODELS, monthSpend } from './client.js';

const BATCH = 10;

// Re-check everything with the latest rules:  npm run triage -- --all
if (process.argv.includes('--all')) {
  db.prepare('UPDATE changes SET triagedAt = NULL').run();
  console.log('Re-triaging all posts with the current rules');
}

const courses = db.prepare('SELECT DISTINCT course FROM files ORDER BY course').all().map((r) => r.course);

const SYSTEM = `You screen official vendor announcements for a corporate training company.

Courses we teach:
${courses.map((c) => `- ${c}`).join('\n')}

Mark an announcement RELEVANT only if a trainer would need to CHANGE or ADD something in one of these courses:
- a service, feature, command, API, setting or model the course covers is renamed, removed, deprecated or retired;
- its console/UI, menus, defaults, limits or behaviour change in a way that could make slides or lab steps wrong;
- a certification exam version for one of these courses is launched, changed or retired;
- a MAJOR new capability of a CORE service or tool the course teaches (something a trainer would mention in class).

Mark NOT relevant:
- new regions, Local Zones, instance types or availability expansions;
- niche or advanced options beyond the course's level, minor parameters, small integrations;
- minor bug fixes, small performance improvements, pricing tweaks, partner or marketing news;
- anything about products none of the courses cover.
Foundational courses (e.g. Cloud Practitioner) only care about major, well-known services and concepts.
When unsure, mark NOT relevant.

For relevant items, "keywords" must be 3-6 specific words or phrases likely to appear in our slides
(product names, feature names, commands, console menu names).
Use the exact course names from the list above.
Submit one entry per announcement using the submit_result tool.`;

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          relevant: { type: 'boolean' },
          courses: { type: 'array', items: { type: 'string' } },
          products: { type: 'array', items: { type: 'string' } },
          changeType: {
            type: 'string',
            enum: ['removed', 'renamed', 'ui_change', 'behaviour_change', 'pricing', 'new_feature', 'certification', 'other'],
          },
          keywords: { type: 'array', items: { type: 'string' } },
          examCodes: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'relevant'],
      },
    },
  },
  required: ['results'],
};

const save = db.prepare(`
  UPDATE changes SET relevant = ?, courses = ?, products = ?, changeType = ?, keywords = ?,
                     examCodes = ?, triagedAt = ? WHERE id = ?`);

const pending = db.prepare(`
  SELECT id, vendor, title, summary, COALESCE(date, firstSeen) AS date
  FROM changes WHERE triagedAt IS NULL ORDER BY date DESC`).all();

console.log(`${pending.length} posts to triage with ${MODELS.triage} (${BATCH} per call)`);
let failedBatches = 0;

for (let i = 0; i < pending.length; i += BATCH) {
  const batch = pending.slice(i, i + BATCH);
  const prompt = JSON.stringify(batch.map((p) => ({
    id: p.id, vendor: p.vendor, date: p.date?.slice(0, 10), title: p.title, summary: (p.summary || '').slice(0, 800),
  })), null, 1);

  try {
    const { results } = await askJson({
      model: MODELS.triage, system: SYSTEM, prompt, maxTokens: 4000, purpose: 'triage', schema: SCHEMA,
    });
    const now = new Date().toISOString();
    for (const r of results || []) {
      if (!batch.some((p) => p.id === r.id)) continue; // ignore unknown ids
      save.run(r.relevant ? 1 : 0, JSON.stringify(r.courses || []), JSON.stringify(r.products || []),
               r.changeType || 'other', JSON.stringify(r.keywords || []), JSON.stringify(r.examCodes || []), now, r.id);
    }
  } catch (err) {
    failedBatches++;
    console.log(`\n⚠ Batch ${i / BATCH + 1}: ${err.message}`);
    if (/cap reached/i.test(err.message)) break;
  }
  process.stdout.write(`\r  Triaged ${Math.min(i + BATCH, pending.length)}/${pending.length}`);
}

const stats = db.prepare(`
  SELECT SUM(relevant = 1) AS relevant, SUM(relevant = 0) AS notRelevant, SUM(triagedAt IS NULL) AS pending
  FROM changes`).get();
console.log(`\n\nRelevant: ${stats.relevant} · Not relevant: ${stats.notRelevant} · Still pending: ${stats.pending}`);
console.log(`Failed batches: ${failedBatches} · AI spend this month: $${monthSpend().toFixed(4)}`);

console.log('\nLatest relevant posts:');
for (const s of db.prepare(`
  SELECT vendor, title, courses, changeType FROM changes
  WHERE relevant = 1 ORDER BY COALESCE(date, firstSeen) DESC LIMIT 15`).all()) {
  console.log(`  [${s.vendor}] ${s.title}\n     → ${JSON.parse(s.courses || '[]').join(', ')} (${s.changeType})`);
}