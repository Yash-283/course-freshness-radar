import { db } from './db/db.js';

// Remove sample flags:  npm run remove-samples
if (process.argv.includes('--remove')) {
  const r = db.prepare('DELETE FROM flags WHERE isSample = 1').run();
  console.log(`Removed ${r.changes} sample flags`);
  process.exit(0);
}

// Add 3 clearly-labelled SAMPLE flags on real course chunks, to test the dashboard
const change = db.prepare('SELECT id FROM changes ORDER BY COALESCE(date, firstSeen) DESC LIMIT 1').get();
const picks = db.prepare(`
  SELECT id, course, location, substr(text, 1, 400) AS text
  FROM chunks WHERE length(text) > 200 ORDER BY RANDOM() LIMIT 3`).all();

const insert = db.prepare(`
  INSERT OR IGNORE INTO flags (changeId, chunkId, course, location, impact, verdict, reason,
    currentText, suggestedText, confidence, checkedBy, status, createdAt, isSample)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, 1)`);

const impacts = ['High', 'Medium', 'Low'];
picks.forEach((c, i) => {
  insert.run(change?.id ?? null, c.id, c.course, c.location, impacts[i], 'sample',
    '[SAMPLE] This is a made-up flag to test the dashboard. Real flags will come from the AI judge.',
    c.text,
    '[SAMPLE] The AI-suggested update will appear here.',
    0.8, 'sample', new Date().toISOString());
});
console.log(`Added ${picks.length} SAMPLE flags (remove later with: npm run remove-samples)`);