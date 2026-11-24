import JSZip from 'jszip';

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Pull readable text from slide XML, one line per paragraph
function textFromXml(xml) {
  const paragraphs = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) || [];
  return paragraphs
    .map((p) => [...p.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decode(m[1])).join(''))
    .filter((line) => line.trim())
    .join('\n');
}

// Read relationship file into { Id: Target }
function readRels(xml = '') {
  const map = {};
  for (const tag of xml.match(/<Relationship\b[^>]*>/g) || []) {
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) map[id] = target;
  }
  return map;
}

export async function extractPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const read = async (p) => (zip.file(p) ? zip.file(p).async('string') : '');

  // Slide order as shown in PowerPoint
  const presRels = readRels(await read('ppt/_rels/presentation.xml.rels'));
  const presXml = await read('ppt/presentation.xml');
  let slidePaths = [...presXml.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)]
    .map((m) => presRels[m[1]])
    .filter(Boolean)
    .map((t) => `ppt/${t.replace(/^\/?ppt\//, '')}`);

  if (!slidePaths.length) {
    slidePaths = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  }

  const chunks = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const slidePath = slidePaths[i];
    const slideText = textFromXml(await read(slidePath));

    // Speaker notes linked to this slide
    const relsPath = slidePath.replace('slides/', 'slides/_rels/') + '.rels';
    const notesTarget = Object.values(readRels(await read(relsPath))).find((t) => t.includes('notesSlide'));
    const notes = notesTarget ? textFromXml(await read(`ppt/notesSlides/${notesTarget.split('/').pop()}`)) : '';

    const text = [slideText, notes && `[Speaker notes]\n${notes}`].filter(Boolean).join('\n');
    if (text.trim()) chunks.push({ location: `Slide ${i + 1}`, text });
  }
  return chunks;
}