import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { db } from '../db/db.js';
import { recipientsFor } from './owners.js';
import { alertEmail, digestEmail, adminEmail } from './templates.js';
import { sendEmail } from './send.js';
import { courseScores } from '../flags/score.js';

const IMMEDIATE = (process.env.NOTIFY_IMMEDIATE_IMPACTS || 'High,Certification').split(',').map((s) => s.trim()).filter(Boolean);
const DIGEST_DAY = (process.env.DIGEST_DAY || 'Monday').toLowerCase();
const ADMIN = process.env.ADMIN_EMAIL;

const FLAG_SELECT = `
  SELECT f.*, c.title, c.vendor, c.link, COALESCE(c.date, c.firstSeen) AS changeDate, fi.webUrl AS fileUrl
  FROM flags f
  LEFT JOIN changes c ON c.id = f.changeId
  LEFT JOIN files fi ON fi.id = f.fileId`;

const logNotification = db.prepare(`
  INSERT INTO notifications (at, type, recipients, subject, flagIds, mode, file) VALUES (?, ?, ?, ?, ?, ?, ?)`);

// { email -> [flags] }  (one email per person, even if they own several courses)
const ONE_PER_COURSE = (process.env.NOTIFY_ONE_EMAIL_PER_COURSE || 'true') === 'true';

// Group flags into emails. perCourse=true → one email per (recipient, course), easy to forward
function groupByRecipient(flags, { perCourse = false } = {}) {
  const map = new Map();
  for (const f of flags) {
    for (const r of recipientsFor(f.course)) {
      const key = perCourse ? `${r}|||${f.course}` : r;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
  }
  // return [email, flags] pairs
  return [...map.entries()].map(([key, list]) => [key.split('|||')[0], list]);
}

// Send + log in one place
async function deliver({ to, subject, html, type, flagIds = [] }) {
  const res = await sendEmail({ to, subject, html, type });
  logNotification.run(new Date().toISOString(), type, to.join(', '), subject, JSON.stringify(flagIds), res.mode, res.file ?? null);
  return res;
}

// ---- 1. Immediate alerts: new High / Certification flags not yet emailed ----
export async function sendAlerts() {
  const flags = db.prepare(`${FLAG_SELECT}
    WHERE f.impact IN (${IMMEDIATE.map(() => '?').join(',')})
      AND f.status = 'New' AND f.notifiedAt IS NULL AND f.isSample = 0
    ORDER BY f.course, f.id`).all(...IMMEDIATE);

  if (!flags.length) { console.log('  Alerts: nothing new to send'); return 0; }

  const failed = new Set();
  let sent = 0;
    for (const [to, list] of groupByRecipient(flags, { perCourse: ONE_PER_COURSE })) {
    const { subject, html } = alertEmail(list);
    try {
      await deliver({ to: [to], subject, html, type: 'alert', flagIds: list.map((f) => f.id) });
      sent++;
      console.log(`  Alert → ${to}: ${list.length} flag(s)`);
    } catch (err) {
      console.log(`  ⚠ Alert to ${to} failed: ${err.message}`);
      list.forEach((f) => failed.add(f.id));
    }
  }

  // Mark as notified ONLY if sending worked (failed ones are retried next run)
  const mark = db.prepare('UPDATE flags SET notifiedAt = ? WHERE id = ?');
  const now = new Date().toISOString();
  for (const f of flags) if (!failed.has(f.id)) mark.run(now, f.id);
  return sent;
}

// ---- 2. Weekly digest: all open flags, on DIGEST_DAY, once per week ----
function digestSentThisWeek() {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE type = 'digest' AND at >= ?")
           .get(monday.toISOString()).n > 0;
}

export async function sendDigest({ force = false } = {}) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  if (!force && (today !== DIGEST_DAY || digestSentThisWeek())) { console.log('  Digest: not due today'); return 0; }

  const open = db.prepare(`${FLAG_SELECT}
    WHERE f.status IN ('New', 'Accepted') AND f.isSample = 0 ORDER BY f.course, f.id`).all();
  if (!open.length) { console.log('  Digest: no open flags'); return 0; }

  const scores = new Map(courseScores().map((c) => [c.course, c]));
  let sent = 0;
  for (const [to, list] of groupByRecipient(open)) {
    const courses = [...new Set(list.map((f) => f.course))].map((course) => ({
      course,
      score: scores.get(course)?.score ?? 100,
      status: scores.get(course)?.status ?? 'Fresh',
      flags: list.filter((f) => f.course === course),
    }));
    const { subject, html } = digestEmail(courses);
    try {
      await deliver({ to: [to], subject, html, type: 'digest', flagIds: list.map((f) => f.id) });
      sent++;
      console.log(`  Digest → ${to}: ${list.length} open flag(s)`);
    } catch (err) {
      console.log(`  ⚠ Digest to ${to} failed: ${err.message}`);
    }
  }
  return sent;
}

// ---- 3. Admin messages ----
export async function notifyAdmin(subject, lines, type = 'admin') {
  if (!ADMIN) { console.log(`  (ADMIN_EMAIL not set) ${subject}`); return; }
  await deliver({ to: [ADMIN], subject, html: adminEmail(subject, lines), type });
}

// AI spend warning, once per month
export async function checkBudget() {
  const cap = Number(process.env.AI_MONTHLY_CAP_USD || 4.5);
  const pct = Number(process.env.AI_ALERT_PCT || 80);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const spent = db.prepare('SELECT COALESCE(SUM(costUsd), 0) AS s FROM ai_usage WHERE at >= ?').get(monthStart.toISOString()).s;
  const alreadySent = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE type = 'budget' AND at >= ?")
                        .get(monthStart.toISOString()).n > 0;

  if (spent >= cap * pct / 100 && !alreadySent) {
    await notifyAdmin(`AI spend at ${Math.round((spent / cap) * 100)}% of the monthly cap`,
      [`Spent $${spent.toFixed(2)} of $${cap.toFixed(2)} this month.`, 'AI steps pause automatically when the cap is reached.'], 'budget');
    console.log('  Budget alert sent to admin');
  }
}

// ---- Run directly: npm run notify  /  npm run digest ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Notifications (mode: ${process.env.EMAIL_MODE || 'preview'})`);
  await sendAlerts();
  await sendDigest({ force: process.argv.includes('--digest') });
  await checkBudget();
}