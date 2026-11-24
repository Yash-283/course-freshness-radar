import { sectionsToChunks } from './split.js';

export function extractMd(buffer) {
  const sections = [];
  let current = { heading: 'Top', lines: [] };

  for (const line of buffer.toString('utf8').split(/\r?\n/)) {
    const m = line.match(/^#{1,4}\s+(.*)/);
    if (m) {
      if (current.lines.join('').trim()) sections.push(current);
      current = { heading: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.join('').trim()) sections.push(current);
  return sectionsToChunks(sections);
}