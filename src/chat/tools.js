// READ-ONLY tools for the Ask Radar chat. Each one only reads the database.
import { db } from '../db/db.js';
import { courseScores } from '../flags/score.js';

const OPEN = "('New', 'Accepted')";
const courseLink = (course) => `#/course?c=${encodeURIComponent(course)}`;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

// "claude code for developers" → "AI Powered Coding › Claude Code for Developers"
function findCourse(name) {
  if (!name) return null;
  const all = courseScores().map((c) => c.course);
  const n = norm(name);
  return all.find((c) => norm(c) === n) || all.find((c) => norm(c.split(' › ').pop()) === n)
    || all.find((c) => norm(c).includes(n)) || null;
}

// A short piece of text around the first match
function snippet(text, query, size = 320) {
  const i = text.toLowerCase().indexOf(String(query).toLowerCase());
  const start = Math.max(0, (i < 0 ? 0 : i) - 120);
  return (start > 0 ? '…' : '') + cut(text.slice(start, start + size), size);
}

export const TOOL_DEFS = [
  {
    name: 'search_course_content',
    description: 'Exact text search across ALL indexed course material. Returns a summary, the COMPLETE list of files containing the term (with links), and example places (slides incl. speaker notes, reference books, labs, curricula, cheat sheets) of the latest versions. Use for "where do we mention X". Search one term or short phrase per call; call again for synonyms or old/new names.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Word or phrase to find, e.g. "Sonnet 4.5" or "Cowork"' },
        course: { type: 'string', description: 'Optional: limit to one course (name or part of it)' },
        limit: { type: 'integer', description: 'Max results (default 15, max 30)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_courses',
    description: 'All monitored courses with freshness score (0-100), status (Fresh / Needs review / At risk), number of open vendor changes and places to update.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_course_flag',
    description: 'The open course flag of one course: every open vendor change with its impact and every place (slide/section/lab) to update, with current text, suggested update and reason.',
    input_schema: {
      type: 'object',
      properties: { course: { type: 'string', description: 'Course name or part of it' } },
      required: ['course'],
    },
  },
  {
    name: 'search_vendor_news',
    description: 'Official vendor announcements collected by Radar (AWS, AWS certification, GitHub/Copilot, Anthropic/Claude). Filter by words, vendor, age, or relevance to our courses.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional words to find in title/summary' },
        vendor: { type: 'string', description: 'Optional: AWS, GitHub or Anthropic' },
        days: { type: 'integer', description: 'Optional: only posts from the last N days' },
        relevantOnly: { type: 'boolean', description: 'Only posts marked relevant to our courses' },
        limit: { type: 'integer', description: 'Max results (default 15, max 30)' },
      },
    },
  },
  {
    name: 'get_place_detail',
    description: 'Full detail of one flagged place (by its id from get_course_flag): full current text, suggested update, reason, confidence, the vendor announcement and its link, review history.',
    input_schema: {
      type: 'object',
      properties: { placeId: { type: 'integer' } },
      required: ['placeId'],
    },
  },
];

const fileRow = db.prepare('SELECT rowid AS n, webUrl FROM files WHERE id = ?');
// Short link for a file: /open/42 → the server redirects to the real SharePoint URL (keeps answers short)
const fileLink = (fileId) => { const r = fileId && fileRow.get(fileId); return r?.webUrl ? `/open/${r.n}` : null; };
// Skip non-DS decks if the DS-slides check is installed (files.excluded column exists)
const hasExcluded = db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('files') WHERE name = 'excluded'").get().n > 0;
const NOT_EXCLUDED = hasExcluded ? ' AND fileId NOT IN (SELECT id FROM files WHERE excluded = 1)' : '';

export const TOOLS = {
  search_course_content({ query, course, limit = 15 }) {
    query = String(query || '').trim();
    if (query.length < 2) return { error: 'query too short' };
    limit = Math.min(Math.max(Number(limit) || 15, 1), 30);
    const c = course ? findCourse(course) : null;
    if (course && !c) return { error: `no course matches "${course}"`, courses: courseScores().map((x) => x.course) };
    const where = `ch.text LIKE ?${NOT_EXCLUDED.replace('fileId', 'ch.fileId')}${c ? ' AND ch.course = ?' : ''}`;
    const args = [`%${query}%`, ...(c ? [c] : [])];
    const perCourse = db.prepare(`SELECT ch.course, COUNT(*) AS n FROM chunks ch WHERE ${where} GROUP BY ch.course ORDER BY n DESC`).all(...args);
    const total = perCourse.reduce((sum, x) => sum + x.n, 0);
    if (!total) return { query, totalMatches: 0, summary: `"${query}" was not found in any course material.` };

    // COMPLETE list of files containing the term (grouped by course), with a short link each
    const files = db.prepare(`
      SELECT ch.course, f.path, ch.fileId, COUNT(*) AS matches
      FROM chunks ch JOIN files f ON f.id = ch.fileId
      WHERE ${where} GROUP BY ch.course, ch.fileId ORDER BY ch.course, f.path LIMIT 100`).all(...args)
      .map((r) => ({ course: r.course.split(' › ').pop(), file: r.path, matches: r.matches, link: fileLink(r.fileId) }));

    // A few example places from EVERY course (spread evenly)
    const each = Math.max(2, Math.ceil(limit / perCourse.length));
    const rowsFor = db.prepare(`SELECT ch.fileId, ch.course, ch.location, ch.text FROM chunks ch
      WHERE ${where.replace(' AND ch.course = ?', '')} AND ch.course = ? ORDER BY ch.location LIMIT ?`);
    const examples = [];
    for (const pc of perCourse) {
      for (const r of rowsFor.all(`%${query}%`, pc.course, each)) {
        examples.push({ course: r.course.split(' › ').pop(), location: r.location, snippet: snippet(r.text, query, 220), link: fileLink(r.fileId) });
      }
    }
    return {
      query,
      totalMatches: total,
      // Plain summary so no course is left out of the answer
      summary: `"${query}" appears in ${perCourse.length} course(s), ${files.length} file(s), ${total} place(s): ` +
        perCourse.map((x) => `${x.course.split(' › ').pop()} (${x.n})`).join(', ') + '.',
      matchesPerCourse: perCourse.map((x) => ({ course: x.course, matches: x.n, courseFlagLink: courseLink(x.course) })),
      files,                       // complete list – use this when asked for files
      examples: examples.slice(0, Math.max(limit, perCourse.length * 2)),
    };
  },

  list_courses() {
    return courseScores().map((c) => ({
      course: c.course, area: c.area, score: c.score, status: c.status,
      openChanges: c.changes ?? null, placesToUpdate: c.places ?? c.open,
      highOrCertification: c.high, medium: c.medium, low: c.low, files: c.files, courseFlagLink: courseLink(c.course),
    }));
  },

  get_course_flag({ course }) {
    const c = findCourse(course);
    if (!c) return { error: `no course matches "${course}"`, courses: courseScores().map((x) => x.course) };
    const score = courseScores().find((x) => x.course === c);
    const rows = db.prepare(`
      SELECT f.id, f.changeId, f.fileId, f.location, f.impact, f.status, f.confidence, f.currentText, f.suggestedText, f.reason,
             c.title, c.vendor, c.link, COALESCE(c.date, c.firstSeen) AS changeDate
      FROM flags f LEFT JOIN changes c ON c.id = f.changeId
      WHERE f.course = ? AND f.status IN ${OPEN} ORDER BY f.location`).all(c);
    const changes = new Map();
    for (const r of rows) {
      if (!changes.has(r.changeId)) changes.set(r.changeId, { change: r.title, vendor: r.vendor, date: String(r.changeDate || '').slice(0, 10), announcement: r.link, places: [] });
      changes.get(r.changeId).places.push({
        placeId: r.id, location: r.location, impact: r.impact, status: r.status, confidence: r.confidence,
        currentText: cut(r.currentText, 300), suggestedUpdate: cut(r.suggestedText, 300), reason: cut(r.reason, 300), fileLink: fileLink(r.fileId),
      });
    }
    return { course: c, score: score?.score, status: score?.status, courseFlagLink: courseLink(c), openChanges: [...changes.values()] };
  },

  search_vendor_news({ query, vendor, days, relevantOnly, limit = 15 }) {
    limit = Math.min(Math.max(Number(limit) || 15, 1), 30);
    const where = []; const args = [];
    if (query) { where.push('(title LIKE ? OR summary LIKE ?)'); args.push(`%${query}%`, `%${query}%`); }
    if (vendor) { where.push('vendor LIKE ?'); args.push(`%${vendor}%`); }
    if (days) { where.push('COALESCE(date, firstSeen) >= ?'); args.push(new Date(Date.now() - Number(days) * 864e5).toISOString().slice(0, 10)); }
    if (relevantOnly) where.push('relevant = 1');
    const rows = db.prepare(`
      SELECT vendor, title, link, COALESCE(date, firstSeen) AS d, relevant, courses, changeType, summary FROM changes
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d DESC LIMIT ?`).all(...args, limit);
    return rows.map((r) => ({
      vendor: r.vendor, title: r.title, date: String(r.d || '').slice(0, 10), link: r.link,
      relevantToOurCourses: !!r.relevant, affectedCourses: JSON.parse(r.courses || '[]'), changeType: r.changeType,
      summary: cut(r.summary, 400),
    }));
  },

  get_place_detail({ placeId }) {
    const r = db.prepare(`
      SELECT f.*, c.title, c.vendor, c.link, c.summary, COALESCE(c.date, c.firstSeen) AS changeDate
      FROM flags f LEFT JOIN changes c ON c.id = f.changeId WHERE f.id = ?`).get(Number(placeId));
    if (!r) return { error: 'no such place' };
    return {
      placeId: r.id, course: r.course, location: r.location, impact: r.impact, status: r.status, confidence: r.confidence,
      checkedBy: r.checkedBy, currentText: r.currentText, suggestedUpdate: r.suggestedText, reason: r.reason,
      fileLink: fileLink(r.fileId), courseFlagLink: courseLink(r.course),
      vendorChange: { title: r.title, vendor: r.vendor, date: String(r.changeDate || '').slice(0, 10), link: r.link, summary: cut(r.summary, 800) },
      history: db.prepare('SELECT action, note, at FROM reviews WHERE flagId = ? ORDER BY at DESC').all(r.id),
    };
  },
};