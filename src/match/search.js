import { db } from '../db/db.js';

// Words too general to identify a specific slide
const GENERIC = new Set(['aws', 'amazon', 'claude', 'anthropic', 'github', 'copilot', 'api',
  'cloud', 'ai', 'model', 'models', 'feature', 'features', 'new', 'support', 'service']);

// Match course names even if the AI changed spaces/punctuation ("AIPowered Coding" -> "AI Powered Coding")
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
let courseMap = null;
export function resolveCourses(names = []) {
  if (!courseMap) {
    courseMap = new Map(db.prepare('SELECT DISTINCT course FROM chunks').all().map((r) => [norm(r.course), r.course]));
  }
  return [...new Set(names.map((n) => courseMap.get(norm(n))).filter(Boolean))];
}

// Curriculum lists every topic, so it matches too easily - give the detailed material priority
const isCurriculum = (loc) => /curriculum/i.test(loc);
const typeWeight = (loc) =>
  isCurriculum(loc) ? 0.5
  : /\.pptx|slide|lab|ref ?book|reference|sig|cheat/i.test(loc) ? 1.5
  : 1;

// Find the course chunks most related to a vendor change
export function findChunks({ courses, keywords = [], products = [], limit = 10, perCourse = 4 }) {
  courses = resolveCourses(courses);
  const terms = [...new Set([...keywords, ...products].map((t) => String(t).trim()))]
    .filter((t) => t.length >= 3 && !GENERIC.has(t.toLowerCase()));
  if (!terms.length || !courses.length) return [];

  const rows = db.prepare(`
    SELECT id, fileId, course, location, text FROM chunks
    WHERE course IN (${courses.map(() => '?').join(',')})
      AND (${terms.map(() => 'text LIKE ?').join(' OR ')})
      AND fileId NOT IN (SELECT id FROM files WHERE excluded = 1)
    LIMIT 5000`).all(...courses, ...terms.map((t) => `%${t}%`));

  const scored = rows
    .map((r) => {
      const low = r.text.toLowerCase();
      const hits = terms.reduce((s, t) => s + (low.includes(t.toLowerCase()) ? t.split(/\s+/).length : 0), 0);
      return { ...r, score: hits * typeWeight(r.location) };
    })
    .sort((a, b) => b.score - a.score);

  const out = [];
  const perCourseCount = {};
  const curriculumCount = {};
  for (const r of scored) {
    if ((perCourseCount[r.course] || 0) >= perCourse) continue;
    if (isCurriculum(r.location) && curriculumCount[r.course]) continue; // max 1 curriculum chunk per course
    perCourseCount[r.course] = (perCourseCount[r.course] || 0) + 1;
    if (isCurriculum(r.location)) curriculumCount[r.course] = 1;
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// For certification news: the first curriculum chunks of each course
export function curriculumChunks(courses, perCourse = 2) {
  courses = resolveCourses(courses);
  const out = [];
  for (const course of courses) {
    out.push(...db.prepare(`
      SELECT id, fileId, course, location, text FROM chunks
      WHERE course = ? AND location LIKE '%urriculum%'
        AND fileId NOT IN (SELECT id FROM files WHERE excluded = 1)
      ORDER BY id LIMIT ?`).all(course, perCourse));
  }
  return out;
}