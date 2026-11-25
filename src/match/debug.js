import { db } from '../db/db.js';
import { findChunks, curriculumChunks } from './search.js';

// Usage: npm run match-debug -- "Haiku 5.5"   (part of a relevant post's title)
const term = process.argv[2] || '';
const ch = db.prepare(`SELECT * FROM changes WHERE relevant = 1 AND title LIKE ? LIMIT 1`).get(`%${term}%`);
if (!ch) { console.log(`No relevant post with "${term}" in the title`); process.exit(0); }

const parse = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
const courses = parse(ch.courses);
console.log(`POST: ${ch.title}\nCourses (from triage): ${courses.join(' | ')}`);
console.log(`Keywords: ${parse(ch.keywords).join(', ')}\nProducts: ${parse(ch.products).join(', ')}\n`);

const chunks = ch.changeType === 'certification'
  ? curriculumChunks(courses)
  : findChunks({ courses, keywords: parse(ch.keywords), products: parse(ch.products) });

console.log(`Matched ${chunks.length} chunks:`);
for (const c of chunks) console.log(`  [score ${c.score?.toFixed(1) ?? '-'}] ${c.course} › ${c.location}`);