import path from 'node:path';
import { extractPptx } from './pptx.js';
import { extractDocx } from './docx.js';
import { extractPdf } from './pdf.js';
import { extractMd } from './md.js';

export async function extractChunks(fileName, buffer) {
  switch (path.extname(fileName).toLowerCase()) {
    case '.pptx': return extractPptx(buffer);
    case '.docx': return extractDocx(buffer);
    case '.pdf':  return extractPdf(buffer);
    case '.md':   return extractMd(buffer);
    default:      return [];
  }
}