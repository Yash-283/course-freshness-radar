import { db } from '../db/db.js';

console.log('Posts per source:');
for (const r of db.prepare('SELECT source, COUNT(*) AS n FROM changes GROUP BY source').all()) {
  console.log(`  ${r.source}: ${r.n}`);
}

console.log('\nLatest 5 posts:');
const latest = db.prepare(`
  SELECT vendor, title, COALESCE(date, firstSeen) AS d, link
  FROM changes ORDER BY d DESC LIMIT 5`).all();
for (const r of latest) {
  console.log(`\n[${r.vendor}] ${r.d?.slice(0, 10)}  ${r.title}\n   ${r.link}`);
}