import { db } from '../db/db.js';

// Points taken off a course's score for each open flag
export const WEIGHTS = { Certification: 15, High: 15, Medium: 8, Low: 3 };

export const statusFor = (score) =>
  score >= 90 ? 'Fresh' : score >= 70 ? 'Needs review' : 'At risk';

// One row per course: files, chunks, open flags by impact, score, status
export function courseScores() {
  const courses = db.prepare(`
    SELECT course, area, COUNT(*) AS files, MAX(indexedAt) AS lastIndexed
    FROM files GROUP BY course, area ORDER BY area, course`).all();

  const flagCounts = db.prepare(`
    SELECT course, impact, COUNT(*) AS n FROM flags
    WHERE status IN ('New', 'Accepted') GROUP BY course, impact`).all();

  const chunkCounts = db.prepare('SELECT course, COUNT(*) AS n FROM chunks GROUP BY course').all();

  return courses.map((c) => {
    const mine = flagCounts.filter((f) => f.course === c.course);
    const count = (impact) => mine.find((f) => f.impact === impact)?.n || 0;
    const penalty = mine.reduce((sum, f) => sum + (WEIGHTS[f.impact] || 0) * f.n, 0);
    const score = Math.max(0, 100 - penalty);
    return {
      ...c,
      chunks: chunkCounts.find((x) => x.course === c.course)?.n || 0,
      high: count('High') + count('Certification'),
      medium: count('Medium'),
      low: count('Low'),
      open: mine.reduce((sum, f) => sum + f.n, 0),
      score,
      status: statusFor(score),
    };
  });
}