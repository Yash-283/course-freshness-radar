import crypto from 'node:crypto';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { db } from '../db/db.js';
import { NEWS_SOURCES } from './sources.js';

const LOOKBACK_DAYS = Number(process.env.NEWS_LOOKBACK_DAYS || 90);
const since = Date.now() - LOOKBACK_DAYS * 864e5;
const UA = 'CourseFreshnessRadar/1.0 (Digi-Safari internal tool)';
const rss = new Parser({ timeout: 20000, headers: { 'User-Agent': UA } });

const clean = (s = '') =>
  s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // markdown links -> text
   .replace(/<[^>]+>/g, ' ')                   // html tags
   .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
   .replace(/[`*_]/g, '')                      // markdown symbols
   .replace(/\s+/g, ' ').trim();
const fingerprint = (...parts) => crypto.createHash('sha1').update(parts.join('|')).digest('hex');
const MONTH_DATE = /^(?:#+\s*)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/;

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ---- RSS feeds (AWS, GitHub) ----
async function fromRss(src) {
  const feed = await rss.parseURL(src.url);
  return feed.items.map((it) => ({
    title: clean(it.title),
    link: it.link,
    date: it.isoDate || (it.pubDate ? new Date(it.pubDate).toISOString() : null),
    summary: clean(it.contentSnippet || it.content || it.summary || '').slice(0, 1500),
  }));
}

// ---- Pages organised by dates like "October 30, 2026" ----
async function fromDatedPage(src) {
  const body = await fetchText(src.url);

  // Turn the page into a list of {kind, text} lines
  let lines;
  if (src.url.endsWith('.md')) {
    lines = body.split(/\r?\n/).map((l) => ({
      kind: /^\s*[-*]\s+/.test(l) ? 'bullet' : /^#+\s/.test(l) ? 'heading' : 'text',
      text: clean(l.replace(/^\s*[-*]\s+/, '').replace(/^#+\s*/, '')),
    }));
  } else {
    const $ = cheerio.load(body);
    $('script, style, nav, footer').remove();
    lines = [];
    $('h1, h2, h3, h4, p, li').each((_, el) => {
      const tag = el.name.toLowerCase();
      lines.push({ kind: tag === 'li' ? 'bullet' : tag.startsWith('h') ? 'heading' : 'text', text: clean($(el).text()) });
    });
  }

  // Group lines into items under each date
  const items = [];
  let date = null;
  let current = null;
  const push = () => { if (current && date) items.push(current); current = null; };

  for (const { kind, text } of lines) {
    if (!text) continue;
    if (MONTH_DATE.test(text)) { push(); date = new Date(text).toISOString(); continue; }
    if (!date) continue;

    if (kind === 'heading' || kind === 'bullet' || !current) {
      push();
      current = { title: text.slice(0, 160), link: src.link || src.url, date, summary: text };
    } else {
      current.summary += ` ${text}`; // paragraph belongs to the item above
    }
  }
  push();
  return items
    .filter((i) => i.summary.length > 30)
    .map((i) => ({ ...i, summary: i.summary.slice(0, 1500) }));
}

// ---- Claude Code changelog: "## 2.1.325" followed by bullet points ----
async function fromVersionedMd(src) {
  const md = await fetchText(src.url);
  const versions = md.split(/\n(?=##\s+\d)/).slice(1, 31); // latest 30 versions
  return versions.map((block) => {
    const [heading, ...rest] = block.split('\n');
    const version = heading.replace(/^#+\s*/, '').trim();
    return {
      title: `Claude Code ${version}`,
      link: src.link,
      date: null, // changelog has no dates; we use the day we first saw it
      summary: clean(rest.join(' ')).slice(0, 1500),
    };
  });
}

// ---- Main ----
const insert = db.prepare(`
  INSERT OR IGNORE INTO changes (id, source, vendor, title, link, date, summary, firstSeen)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const linkExists = db.prepare('SELECT 1 FROM changes WHERE link = ? LIMIT 1');
const now = new Date().toISOString();
let totalNew = 0;

console.log(`Collecting vendor news (last ${LOOKBACK_DAYS} days)...`);
for (const src of NEWS_SOURCES) {
  try {
    const raw =
      src.type === 'rss' ? await fromRss(src) :
      src.type === 'dated-page' ? await fromDatedPage(src) :
      await fromVersionedMd(src);

    const items = raw.filter((i) => i.title && (!i.date || Date.parse(i.date) >= since));
    let added = 0;
        for (const i of items) {
      // Same announcement published in two feeds (e.g. GitHub changelog + Copilot feed) → keep one
      if (i.link && src.type === 'rss' && linkExists.get(i.link)) continue;
      added += insert.run(fingerprint(src.id, i.title, i.date || ''), src.id, src.vendor,
                          i.title, i.link, i.date, i.summary, now).changes;
    }
    totalNew += added;
    console.log(`  ✅ ${src.id}: ${items.length} posts, ${added} new`);
  } catch (err) {
    console.log(`  ⚠ ${src.id}: ${err.message} (skipped, others continue)`);
  }
}

const total = db.prepare('SELECT COUNT(*) AS n FROM changes').get().n;
console.log(`\nDone: ${totalNew} new posts saved, ${total} posts in the news archive`);