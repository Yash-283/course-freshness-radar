import fs from 'node:fs';

// Compare course names ignoring spaces/punctuation/capitals
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
let cache = null;

function load() {
  if (cache) return cache;
  const raw = fs.existsSync('owners.json') ? JSON.parse(fs.readFileSync('owners.json', 'utf8')) : {};
  const byCourse = new Map();
  for (const [course, emails] of Object.entries(raw)) {
    if (course !== 'default') byCourse.set(norm(course), [].concat(emails).filter(Boolean));
  }
  const fallback = [].concat(raw.default || []).filter(Boolean);
  if (!fallback.length && process.env.ADMIN_EMAIL) fallback.push(process.env.ADMIN_EMAIL);
  cache = { byCourse, fallback };
  return cache;
}

// Email addresses for a course (falls back to "default", then ADMIN_EMAIL)
export function recipientsFor(course) {
  const { byCourse, fallback } = load();
  const list = byCourse.get(norm(course));
  if (list?.length) return list;
  return fallback.length ? fallback : ['(owner not set)'];
}