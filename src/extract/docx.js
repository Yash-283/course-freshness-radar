import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { sectionsToChunks } from './split.js';

export async function extractDocx(buffer) {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const $ = cheerio.load(html);

  const sections = [];
  let current = { heading: 'Introduction', lines: [] };
  const clean = (t) => t.replace(/\s+/g, ' ').trim();

  $('body').children().each((_, el) => {
    const tag = (el.name || '').toLowerCase();
    const text = clean($(el).text());
    if (!text) return;

    if (/^h[1-4]$/.test(tag)) {
      if (current.lines.length) sections.push(current);
      current = { heading: text, lines: [] };
    } else if (tag === 'ol' || tag === 'ul') {
      $(el).children('li').each((i, li) => {
        current.lines.push(`${tag === 'ol' ? `${i + 1}.` : '-'} ${clean($(li).text())}`);
      });
    } else {
      current.lines.push(text);
    }
  });
  if (current.lines.length) sections.push(current);

  return sectionsToChunks(sections);
}