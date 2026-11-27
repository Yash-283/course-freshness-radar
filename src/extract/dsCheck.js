import crypto from 'node:crypto';
import JSZip from 'jszip';

// Is this PowerPoint built on a Digi-Safari (DS) template?
// We look INSIDE the file (not at its name). A deck is DS if at least one is true:
//   1. LOGO: its slide master / layouts contain the DS logo image (exact image fingerprint)
//   2. NAME: its template or theme name starts with "DS_" (e.g. "DS_AWS_Theme")
// Both DS templates (AI and AWS) carry the same logo, so rule 1 recognises both.
// More logo fingerprints (if the logo is ever replaced) can be added in .env: DS_LOGO_MD5=hash1,hash2
const DS_LOGO_MD5 = new Set([
  '83d900c2db7dd455468dea40dafd6e24',                       // DS logo in both current templates
  ...(process.env.DS_LOGO_MD5 || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
]);

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

export async function checkDsTemplate(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const read = async (p) => (zip.file(p) ? zip.file(p).async('string') : '');
  const reasons = [];

  // 1. DS logo used by the slide master or a layout
  const relFiles = Object.keys(zip.files).filter((f) =>
    /^ppt\/(slideMasters|slideLayouts)\/_rels\/[^/]+\.rels$/.test(f));
  const media = new Set();
  for (const f of relFiles) {
    for (const m of (await read(f)).matchAll(/Target="\.\.\/media\/([^"]+)"/g)) media.add(`ppt/media/${m[1]}`);
  }
  for (const m of media) {
    const file = zip.file(m);
    if (file && DS_LOGO_MD5.has(md5(await file.async('nodebuffer')))) { reasons.push('DS logo in template'); break; }
  }

  // 2. Template / theme name starting with "DS_"
  const template = (await read('docProps/app.xml')).match(/<Template>([^<]*)<\/Template>/)?.[1] || '';
  const themes = [];
  for (const f of Object.keys(zip.files).filter((x) => /^ppt\/theme\/theme\d+\.xml$/.test(x))) {
    const name = (await read(f)).match(/<a:theme\b[^>]*\bname="([^"]*)"/)?.[1];
    if (name) themes.push(name);
  }
  const dsName = [template, ...themes].find((n) => /^DS[_\s-]/i.test(n.trim()));
  if (dsName) reasons.push(`DS template name "${dsName}"`);

  return { isDs: reasons.length > 0, reasons, template, themes };
}