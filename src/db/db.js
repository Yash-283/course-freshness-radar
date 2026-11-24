import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite'; // SQLite built into Node.js - nothing to install

fs.mkdirSync('data', { recursive: true });
const raw = new DatabaseSync('data/radar.db');

raw.exec('PRAGMA journal_mode = WAL;');
raw.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    area TEXT, course TEXT, path TEXT, name TEXT,
    cTag TEXT, size INTEGER, lastModified TEXT, indexedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fileId TEXT, course TEXT, location TEXT, text TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(fileId);

    CREATE TABLE IF NOT EXISTS changes (
    id TEXT PRIMARY KEY,            -- fingerprint, so the same post is never saved twice
    source TEXT, vendor TEXT,
    title TEXT, link TEXT, date TEXT, summary TEXT,
    firstSeen TEXT,
    relevant INTEGER, products TEXT, changeType TEXT,   -- filled later by AI triage
    keywords TEXT, examCodes TEXT, triagedAt TEXT
  );
`);

// Turn values into what SQLite accepts (undefined -> null; {id: ..} -> {'@id': ..})
function fixArgs(args) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Buffer.isBuffer(args[0])) {
    return [Object.fromEntries(Object.entries(args[0]).map(([k, v]) => [`@${k}`, v ?? null]))];
  }
  return args.map((v) => v ?? null);
}

// Small adapter so the rest of our code works unchanged
export const db = {
  prepare(sql) {
    const stmt = raw.prepare(sql);
    return {
      get: (...a) => stmt.get(...fixArgs(a)),
      all: (...a) => stmt.all(...fixArgs(a)),
      run: (...a) => stmt.run(...fixArgs(a)),
    };
  },
  // Run several writes as one all-or-nothing step
  transaction(fn) {
    return (...args) => {
      raw.exec('BEGIN');
      try {
        const result = fn(...args);
        raw.exec('COMMIT');
        return result;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    };
  },
};