import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite'; // SQLite built into Node.js - nothing to install

fs.mkdirSync('data', { recursive: true });

const raw = new DatabaseSync('data/radar.db');

raw.exec('PRAGMA journal_mode = WAL;');

raw.exec(`
  -- Course files found in SharePoint
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    area TEXT, course TEXT, path TEXT, name TEXT,
    cTag TEXT, size INTEGER, lastModified TEXT, indexedAt TEXT
  );

  -- Text pieces of each file (slide, section, lab step)
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fileId TEXT, course TEXT, location TEXT, text TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(fileId);

  -- Vendor news posts (+ AI triage results)
  CREATE TABLE IF NOT EXISTS changes (
    id TEXT PRIMARY KEY,
    source TEXT, vendor TEXT,
    title TEXT, link TEXT, date TEXT, summary TEXT,
    firstSeen TEXT,
    relevant INTEGER, products TEXT, changeType TEXT,
    keywords TEXT, examCodes TEXT, triagedAt TEXT
  );

  -- Every AI call and its cost (for the monthly cap)
  CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT, model TEXT, purpose TEXT,
    inputTokens INTEGER, outputTokens INTEGER, costUsd REAL
  );

  -- Problems found in course content
  CREATE TABLE IF NOT EXISTS flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    changeId TEXT, chunkId INTEGER, course TEXT, location TEXT,
    impact TEXT,
    verdict TEXT, reason TEXT, currentText TEXT, suggestedText TEXT,
    confidence REAL, checkedBy TEXT,
    status TEXT DEFAULT 'New',
    createdAt TEXT, updatedAt TEXT,
    isSample INTEGER DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_flags_unique ON flags(changeId, chunkId, course);

  -- TPM actions on flags (Accept / Dismiss / Fixed)
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flagId INTEGER, action TEXT, note TEXT, at TEXT
  );

  -- Every email sent (or previewed)
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT, type TEXT, recipients TEXT, subject TEXT,
    flagIds TEXT, mode TEXT, file TEXT
  );

  -- One row per daily run
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    startedAt TEXT, finishedAt TEXT, status TEXT,
    steps TEXT, newFlags INTEGER, openFlags INTEGER, aiCost REAL
  );

`);

// Small upgrades to existing tables (ignored if already done)
// Small upgrades to existing tables (ignored if already done)
for (const sql of [
  'ALTER TABLE changes ADD COLUMN courses TEXT',
  'ALTER TABLE changes ADD COLUMN judgedAt TEXT',
  'ALTER TABLE files ADD COLUMN webUrl TEXT',    // SharePoint link of each file
  'ALTER TABLE flags ADD COLUMN fileId TEXT',    // which file a flag belongs to
  'ALTER TABLE flags ADD COLUMN notifiedAt TEXT',   // when a flag was emailed
  'ALTER TABLE files ADD COLUMN isDs INTEGER',      // PPTX only: 1 = DS template, 0 = other template
  'ALTER TABLE files ADD COLUMN excluded INTEGER DEFAULT 0', // 1 = not used for matching (non-DS deck)
]) {
  try { raw.exec(sql); } catch { /* column already exists */ }
}

// Fill in fileId for flags created before this column existed
raw.exec(`UPDATE flags SET fileId = (SELECT fileId FROM chunks WHERE chunks.id = flags.chunkId)
          WHERE fileId IS NULL`);

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