import { db } from '../db/db.js';

// Points taken off a course's score for each open CHANGE affecting it
// (one vendor change counts once per course, however many slides it touches)
export const WEIGHTS = { Certification: 15, High: 15, Medium: 8, Low: 3 };
const BY_RANK = ['Certification', 'High', 'Medium', 'Low'];

export const statusFor = (score) =>
  score >= 90 ? 'Fresh' : score >= 70 ? 'Needs review' : 'At risk';

// One row per course: files, chunks, open changes by impact, places, score, status
export function courseScores() {
  const courses = db.prepare(`
    SELECT course, area, COUNT(*) AS files, MAX(indexedAt) AS lastIndexed
    FROM files GROUP BY course, area ORDER BY area, course`).all();

  // One row per (course, change): its highest impact and how many places it touches
  const perChange = db.prepare(`
    SELECT course, changeId, COUNT(*) AS places,
           MIN(CASE impact WHEN 'Certification' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END) AS r
    FROM flags WHERE status IN ('New', 'Accepted') GROUP BY course, changeId`).all();

  const chunkCounts = db.prepare('SELECT course, COUNT(*) AS n FROM chunks GROUP BY course').all();

  return courses.map((c) => {
    const mine = perChange.filter((x) => x.course === c.course);
    const penalty = mine.reduce((sum, x) => sum + (WEIGHTS[BY_RANK[x.r]] || 0), 0);
    const score = Math.max(0, 100 - penalty);
    const places = mine.reduce((sum, x) => sum + x.places, 0);
    return {
      ...c,
      chunks: chunkCounts.find((x) => x.course === c.course)?.n || 0,
      high: mine.filter((x) => x.r <= 1).length,   // changes, not places
      medium: mine.filter((x) => x.r === 2).length,
      low: mine.filter((x) => x.r === 3).length,
      changes: mine.length,
      places,
      open: places,                                 // kept for older code
      score,
      status: statusFor(score),
    };
  });
}
