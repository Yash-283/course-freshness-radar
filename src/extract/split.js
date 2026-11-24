// Split long text into pieces of about `max` characters, breaking at line ends
export function splitLong(text, max = 1800) {
  if (text.length <= max) return [text];
  const parts = [];
  let buf = '';
  for (const line of text.split('\n')) {
    if (buf && (buf + '\n' + line).length > max) {
      parts.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  if (buf) parts.push(buf);
  // a single very long line: cut it hard
  return parts.flatMap((p) => (p.length > max * 1.5 ? p.match(new RegExp(`[\\s\\S]{1,${max}}`, 'g')) : [p]));
}

// Turn [{heading, lines}] into chunks, splitting big sections into parts
export function sectionsToChunks(sections) {
  return sections.flatMap((s) => {
    const heading = s.heading.slice(0, 80);
    const pieces = splitLong(s.lines.join('\n').trim());
    return pieces.map((t, i) => ({
      location: pieces.length > 1 ? `${heading} (part ${i + 1})` : heading,
      text: `${heading}\n${t}`,
    }));
  });
}