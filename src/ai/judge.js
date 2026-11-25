
import { db } from '../db/db.js';

import { askJson, MODELS, monthSpend } from './client.js';

import { findChunks, curriculumChunks, resolveCourses } from '../match/search.js';


const MAX_SONNET = Number(process.env.AI_MAX_SONNET_PER_RUN || 5);
const MIN_CONFIDENCE = 0.5;
const IMPACT = { wrong: 'High', outdated: 'Medium', new_feature: 'Low' };


// Re-judge everything (removes unreviewed real flags first): npm run judge-all
if (process.argv.includes('--all')) {
  db.prepare('UPDATE changes SET judgedAt = NULL WHERE relevant = 1').run();
  db.prepare("DELETE FROM flags WHERE isSample = 0 AND status = 'New'").run();
  console.log('Re-judging all relevant posts');
}


const JUDGE_SYSTEM = `You are an SME reviewer for Digi-Safari, a corporate training company.
You compare ONE official vendor change with numbered excerpts from OUR course material
(slides, lab instructions, reference books, curricula).

For EACH excerpt choose a verdict:
- "wrong": the excerpt now states something incorrect, or a lab step/command will fail, because of this change
  (removed or renamed feature, changed command, changed default or limit, deprecated/removed model, retired exam).
- "outdated": still works, but uses an old name or behaviour, or misses an important change learners must know.
- "new_feature": the excerpt is correct, but this change adds something worth mentioning exactly here.
- "fine": not affected, or the excerpt only loosely mentions the product.

Rules:
- Use ONLY facts stated in the vendor change. Never guess.
- Most excerpts should be "fine". Only flag a clear, specific connection.
- For certification news: compare exam names/codes/versions in the curriculum with the announcement.
- For non-fine verdicts: quote the exact affected sentence in currentText (max 300 characters),
  write a concrete suggestedText a trainer could paste, a one-sentence reason, and confidence 0-1.
Submit using the submit_result tool.`;


const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'integer' },
          verdict: { type: 'string', enum: ['wrong', 'outdated', 'new_feature', 'fine'] },
          reason: { type: 'string' },
          currentText: { type: 'string' },
          suggestedText: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['item', 'verdict'],
      },
    },
  },
  required: ['results'],
};


const REVIEW_SYSTEM = `You are a senior SME double-checking a flag raised by a first reviewer.
The first reviewer says our course excerpt is WRONG because of an official vendor change.
Check carefully using ONLY the vendor change text.
Return impact: "High" (truly wrong or a lab step will break), "Medium" (outdated but works),
"Low" (minor/optional mention), or "None" (false alarm).
Improve the reason and suggestedText if needed. Submit using the submit_result tool.`;


const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    impact: { type: 'string', enum: ['High', 'Medium', 'Low', 'None'] },
    reason: { type: 'string' },
    suggestedText: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['impact'],
};

const insertFlag = db.prepare(`
  INSERT OR IGNORE INTO flags (changeId, chunkId, fileId, course, location, impact, verdict, reason,
    currentText, suggestedText, confidence, checkedBy, status, createdAt, isSample)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, 0)`);

const markJudged = db.prepare('UPDATE changes SET judgedAt = ? WHERE id = ?');

const knownCourses = new Set(db.prepare('SELECT DISTINCT course FROM chunks').all().map((r) => r.course));

const parse = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };


const changes = db.prepare(`
  SELECT * FROM changes WHERE relevant = 1 AND judgedAt IS NULL
  ORDER BY COALESCE(date, firstSeen) DESC`).all();


console.log(`${changes.length} relevant posts to judge (${MODELS.judge}, High checked by ${MODELS.review})\n`);

let sonnetUsed = 0;
let created = 0;


for (const ch of changes) {
  const now = new Date().toISOString();
  const courses = resolveCourses(parse(ch.courses));
  const isCert = ch.changeType === 'certification';
  const chunks = isCert
    ? curriculumChunks(courses)
    : findChunks({ courses, keywords: parse(ch.keywords), products: parse(ch.products) });

  const label = ch.title.slice(0, 70);
  if (!chunks.length) {
    markJudged.run(now, ch.id);
    console.log(`  – ${label}: no matching course content`);
    continue;
  }


  const prompt =
    `VENDOR CHANGE (${ch.vendor}, ${(ch.date || ch.firstSeen || '').slice(0, 10)}, type: ${ch.changeType})\n` +
    `Title: ${ch.title}\nDetails: ${ch.summary}\nOfficial link: ${ch.link}\n\nOUR COURSE EXCERPTS:\n` +
    chunks.map((c, i) => `[${i + 1}] ${c.course} › ${c.location}\n${c.text.slice(0, 1500)}`).join('\n\n');


  try {
    const { results } = await askJson({
      model: MODELS.judge, system: JUDGE_SYSTEM, prompt, maxTokens: 3000, purpose: 'judge', schema: JUDGE_SCHEMA,
    });


    let flagged = 0;
    for (const r of results || []) {
      const c = chunks[r.item - 1];
      if (!c || r.verdict === 'fine' || (r.confidence ?? 0) < MIN_CONFIDENCE) continue;


      let impact = isCert ? 'Certification' : IMPACT[r.verdict];
      let { reason, suggestedText, confidence } = r;
      let checkedBy = MODELS.judge;


      // Double-check High flags with the stronger model
      if (impact === 'High' && sonnetUsed < MAX_SONNET) {
        sonnetUsed++;
        const review = await askJson({
          model: MODELS.review, system: REVIEW_SYSTEM, maxTokens: 800, purpose: 'review', schema: REVIEW_SCHEMA,
          prompt: `VENDOR CHANGE:\n${ch.title}\n${ch.summary}\n\nOUR EXCERPT (${c.course} › ${c.location}):\n` +
                  `${c.text.slice(0, 1500)}\n\nFIRST REVIEWER: wrong — ${reason}\nSuggested: ${suggestedText}`,
        });
        if (review.impact === 'None') continue; // false alarm removed
        impact = review.impact;
        reason = review.reason || reason;
        suggestedText = review.suggestedText || suggestedText;
        confidence = review.confidence ?? confidence;
        checkedBy += ` + ${MODELS.review}`;
      }


      const res = insertFlag.run(ch.id, c.id, c.fileId, c.course, c.location, impact, r.verdict, reason,
        (r.currentText || c.text).slice(0, 400), suggestedText, confidence, checkedBy, now);

      created += res.changes;
      flagged += res.changes;
    }
    markJudged.run(now, ch.id);
    console.log(`  ${flagged ? '⚑' : '✓'} ${label}: ${chunks.length} excerpts checked, ${flagged} flag(s)`);
  } catch (err) {
    console.log(`  ⚠ ${label}: ${err.message}`);
    if (/cap reached/i.test(err.message)) break;
  }
}


console.log(`\nDone: ${created} new flags · Sonnet reviews: ${sonnetUsed} · AI spend this month: $${monthSpend().toFixed(4)}`);


const byImpact = db.prepare(`
  SELECT impact, COUNT(*) AS n FROM flags WHERE isSample = 0 AND status IN ('New','Accepted') GROUP BY impact`).all();

console.log('Open flags:', byImpact.map((r) => `${r.impact} ${r.n}`).join(' · ') || 'none');
