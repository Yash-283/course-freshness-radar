import { db } from './db/db.js';

// Prepare a live demo: remove UNREVIEWED flags and mark relevant posts as "not judged yet",
// so "Run now" re-judges real vendor posts against real course content and recreates the flags live.
// Flags already Accepted / Dismissed / Fixed are kept.
const removed = db.prepare("DELETE FROM flags WHERE isSample = 0 AND status = 'New'").run().changes;
const reset = db.prepare('UPDATE changes SET judgedAt = NULL WHERE relevant = 1').run().changes;

console.log(`Demo reset: removed ${removed} unreviewed flags, ${reset} relevant posts will be re-judged on the next run.`);
console.log('Now click "Run now" in the dashboard (or run: npm run daily).');