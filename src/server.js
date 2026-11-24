import 'dotenv/config';
import express from 'express';
import { db } from './db/db.js';
import { courseScores } from './flags/score.js';

const app = express();
app.use(express.json());
app.use(express.static('public')); // serves public/index.html

const CAP = Number(process.env.AI_MONTHLY_CAP_USD || 4.5);
const monthStart = () => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

// ---- Overview: courses, totals, AI spend ----
app.get('/api/overview', (req, res) => {
  const totals = db.prepare(`
    SELECT (SELECT COUNT(*) FROM files)  AS files,
           (SELECT COUNT(*) FROM chunks) AS chunks,
           (SELECT COUNT(*) FROM changes) AS news,
           (SELECT COUNT(*) FROM changes WHERE relevant = 1) AS relevantNews,
           (SELECT MAX(indexedAt) FROM files) AS lastIndexed`).get();
  const spent = db.prepare('SELECT COALESCE(SUM(costUsd), 0) AS s FROM ai_usage WHERE at >= ?').get(monthStart()).s;
  res.json({ courses: courseScores(), totals, ai: { spent, cap: CAP } });
});

// ---- Flags list with filters ----
app.get('/api/flags', (req, res) => {
  const { course = '', impact = '', status = 'open' } = req.query;
  const where = [];
  const args = [];
  if (course) { where.push('f.course = ?'); args.push(course); }
  if (impact) { where.push('f.impact = ?'); args.push(impact); }
  if (status === 'open') where.push("f.status IN ('New', 'Accepted')");
  else if (status !== 'all') { where.push('f.status = ?'); args.push(status); }

  const rows = db.prepare(`
    SELECT f.id, f.course, f.location, f.impact, f.status, f.confidence, f.isSample, f.createdAt,
           c.title, c.vendor, COALESCE(c.date, c.firstSeen) AS changeDate
    FROM flags f LEFT JOIN changes c ON c.id = f.changeId
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE f.impact WHEN 'Certification' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
             f.createdAt DESC
    LIMIT 500`).all(...args);
  res.json(rows);
});

// ---- One flag in full ----
app.get('/api/flags/:id', (req, res) => {
  const flag = db.prepare(`
    SELECT f.*, c.title, c.vendor, c.link, c.summary, c.changeType,
           COALESCE(c.date, c.firstSeen) AS changeDate
    FROM flags f LEFT JOIN changes c ON c.id = f.changeId
    WHERE f.id = ?`).get(Number(req.params.id));
  if (!flag) return res.status(404).json({ error: 'Flag not found' });
  flag.history = db.prepare('SELECT action, note, at FROM reviews WHERE flagId = ? ORDER BY at DESC').all(flag.id);
  res.json(flag);
});

// ---- TPM action: Accept / Dismiss / Fixed ----
const ACTIONS = ['Accepted', 'Dismissed', 'Fixed'];
app.post('/api/flags/:id/action', (req, res) => {
  const { action, note = '' } = req.body || {};
  if (!ACTIONS.includes(action)) return res.status(400).json({ error: 'Unknown action' });

  const id = Number(req.params.id);
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE flags SET status = ?, updatedAt = ? WHERE id = ?').run(action, now, id);
  if (!result.changes) return res.status(404).json({ error: 'Flag not found' });

  db.prepare('INSERT INTO reviews (flagId, action, note, at) VALUES (?, ?, ?, ?)')
    .run(id, action, String(note).slice(0, 500), now);
  res.json({ ok: true });
});

// ---- Vendor news ----
app.get('/api/news', (req, res) => {
  const onlyRelevant = req.query.relevant === '1';
  res.json(db.prepare(`
    SELECT vendor, source, title, link, COALESCE(date, firstSeen) AS d, relevant, courses, changeType
    FROM changes ${onlyRelevant ? 'WHERE relevant = 1' : ''}
    ORDER BY d DESC LIMIT 150`).all());
});

// Only reachable from this laptop until proper login is added on AWS
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});