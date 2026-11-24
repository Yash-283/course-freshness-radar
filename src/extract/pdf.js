import { splitLong } from './split.js';

// Works with both old (v1) and new (v2) versions of the pdf-parse library
async function pdfText(buffer) {
  try {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js'); // v1
    return (await pdfParse(buffer)).text;
  } catch (err) {
    if (!/not.?found|NOT_EXPORTED|Cannot find/i.test(`${err.code} ${err.message}`)) throw err;
  }
  const { PDFParse } = await import('pdf-parse'); // v2
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy?.();
  }
}

export async function extractPdf(buffer) {
  const text = (await pdfText(buffer)).replace(/[ \t]+\n/g, '\n').trim();
  return splitLong(text).map((t, i) => ({ location: `Part ${i + 1}`, text: t }));
}