import { db } from "./db/db.js";

// Usage: node src/show-chunks.js "Copilot"
const term = process.argv[2] || "";
const rows = db
  .prepare(
    `
  SELECT course, location, substr(text, 1, 300) AS preview
  FROM chunks WHERE text LIKE ? OR location LIKE ? LIMIT 5`,
  )
  .all(`%${term}%`, `%${term}%`);

for (const r of rows)
  console.log(`\n[${r.course}] ${r.location}\n${r.preview}\n${"-".repeat(60)}`);

const stats = db
  .prepare(
    "SELECT COUNT(DISTINCT fileId) AS files, COUNT(*) AS chunks FROM chunks",
  )
  .get();
console.log(`\nDatabase: ${stats.files} files, ${stats.chunks} chunks`);
