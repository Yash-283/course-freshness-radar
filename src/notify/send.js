import fs from 'node:fs';
import path from 'node:path';

// EMAIL_MODE: preview (save to data/outbox) | ses | graph  (ses/graph added at deployment)
export async function sendEmail({ to, subject, html, type }) {
  const mode = (process.env.EMAIL_MODE || 'preview').toLowerCase();

  if (mode === 'preview') {
    fs.mkdirSync('data/outbox', { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const who = String(to[0] || 'nobody').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    const file = path.join('data', 'outbox', `${stamp}_${type}_${who}.html`);
    fs.writeFileSync(file, html, 'utf8');
    return { mode, file };
  }

  throw new Error(`EMAIL_MODE "${mode}" is not set up yet - use "preview" until SES or Graph is configured`);
}