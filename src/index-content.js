import fs from "node:fs";
import { source } from "./source/index.js";
import { discoverCourses } from "./discover.js";
import { extractChunks } from "./extract/index.js";
import { db } from "./db/db.js";
import { notifyAdmin } from "./notify/notify.js";


const getFile = db.prepare("SELECT cTag FROM files WHERE id = ?");
const deleteChunks = db.prepare("DELETE FROM chunks WHERE fileId = ?");
const deleteFile = db.prepare("DELETE FROM files WHERE id = ?");
const insertChunk = db.prepare(
  "INSERT INTO chunks (fileId, course, location, text) VALUES (?, ?, ?, ?)",
);
const upsertFile = db.prepare(`
  INSERT INTO files (id, area, course, path, name, cTag, size, lastModified, indexedAt, webUrl)
  VALUES (@id, @area, @course, @path, @name, @cTag, @size, @lastModified, @indexedAt, @webUrl)
  ON CONFLICT(id) DO UPDATE SET area=@area, course=@course, path=@path, name=@name,
    cTag=@cTag, size=@size, lastModified=@lastModified, indexedAt=@indexedAt, webUrl=@webUrl`);
const setWebUrl = db.prepare('UPDATE files SET webUrl = ? WHERE id = ?');


// Replace a file's chunks in one safe step
const saveFile = db.transaction((file, chunks) => {
  deleteChunks.run(file.id);
  for (const c of chunks)
    insertChunk.run(file.id, file.course, c.location, c.text);
  upsertFile.run(file);
});


const started = Date.now();
console.log("Finding course files...");
const courses = await discoverCourses((label, n) =>
  console.log(`  ${label}: ${n} files`),
);


const all = courses.flatMap((c) =>
  c.files.map((f) => ({ ...f, area: c.area, course: c.course })),
);
const changed = all.filter((f) => getFile.get(f.id)?.cTag !== (f.cTag ?? ""));
console.log(
  `\n${all.length} files found → ${changed.length} new or changed, ${all.length - changed.length} unchanged (skipped)`,
);

// Keep SharePoint links up to date for ALL files (no download needed)
for (const f of all) if (f.webUrl) setWebUrl.run(f.webUrl, f.id);


let done = 0;
let chunkCount = 0;
const failed = [];


// Download and read 4 files at a time
for (let i = 0; i < changed.length; i += 4) {
  await Promise.all(
    changed.slice(i, i + 4).map(async (f) => {
      try {
        const buffer = await source.readFile(f);
        const chunks = (await extractChunks(f.name, buffer))
          .filter((c) => c.text.trim().length > 20)
          .map((c) => ({
            location: `${f.path} › ${c.location}`,
            text: c.text,
          }));

        saveFile(
          {
            id: f.id,
            area: f.area,
            course: f.course,
            path: f.path,
            name: f.name,
            cTag: f.cTag ?? "",
            size: f.size,
            lastModified: f.lastModified,
            indexedAt: new Date().toISOString(),
            webUrl: f.webUrl ?? null,
          },
          chunks,
        );
        chunkCount += chunks.length;
      } catch (err) {
        failed.push(`${f.course} › ${f.path}: ${err.message}`);
      }
      done++;
      process.stdout.write(`\r  Reading files: ${done}/${changed.length}`);
    }),
  );
}


// Remove files that no longer exist in SharePoint (or moved out of the current version)
const currentIds = new Set(all.map((f) => f.id));
const stale = db
  .prepare("SELECT id FROM files")
  .all()
  .filter((r) => !currentIds.has(r.id));
// Their open flags are closed: the file is no longer part of the latest course material
const closeFileFlags = db.prepare(`
  UPDATE flags SET status = 'Dismissed', updatedAt = ? WHERE fileId = ? AND status IN ('New', 'Accepted')
  RETURNING id`);
const addReview = db.prepare('INSERT INTO reviews (flagId, action, note, at) VALUES (?, ?, ?, ?)');
let autoClosed = 0;
for (const r of stale) {
  const now = new Date().toISOString();
  for (const { id } of closeFileFlags.all(now, r.id)) {
    addReview.run(id, 'Dismissed', 'Closed automatically: file is no longer in the latest version (or was removed from SharePoint)', now);
    autoClosed++;
  }
  deleteChunks.run(r.id);
  deleteFile.run(r.id);
}
if (autoClosed) console.log(`\n${autoClosed} open flag(s) closed because their file is no longer in the latest version`);

// New or changed course content must also be checked against news we already judged.
// Mark those relevant posts as "not judged" so the Judge step re-checks them (cheap: Haiku only).
const touched = [...new Set(changed.map((f) => f.course))];
const rejudge = db.prepare(`
  UPDATE changes SET judgedAt = NULL
  WHERE relevant = 1 AND judgedAt IS NOT NULL AND courses LIKE ?`);
let rejudged = 0;
for (const course of touched) {
  rejudged += rejudge.run(`%${course.split(' › ').pop()}%`).changes;
}
if (rejudged) console.log(`${rejudged} relevant post(s) will be re-checked against the new or changed content`);


const totals = db.prepare("SELECT COUNT(*) AS n FROM chunks").get().n;
const seconds = Math.round((Date.now() - started) / 1000);
console.log(
  `\n\nDone in ${seconds}s: ${chunkCount} chunks added this run, ${stale.length} old files removed, ${totals} chunks in total`,
);


// Version-folder warnings: show them, and email the admin only about NEW ones (once)
const versionWarnings = courses.flatMap((c) => (c.warnings || []).map((w) => `${c.course}: ${w}`));
if (versionWarnings.length) {
  console.log(`\n⚠ ${versionWarnings.length} version-folder warning(s):`);
  for (const w of versionWarnings) console.log(`  - ${w}`);
}
const SENT_FILE = "data/version-warnings-sent.json";
let alreadySent = [];
try { alreadySent = JSON.parse(fs.readFileSync(SENT_FILE, "utf8")); } catch { /* first run */ }
const fresh = versionWarnings.filter((w) => !alreadySent.includes(w));
if (fresh.length) {
  try {
    await notifyAdmin(`Check version folders: ${fresh.length} new warning(s)`, fresh);
  } catch (err) {
    console.log(`  (could not email the admin: ${err.message})`);
  }
}
fs.writeFileSync(SENT_FILE, JSON.stringify(versionWarnings, null, 2), "utf8");


if (failed.length) {
  fs.writeFileSync("data/index-errors.txt", failed.join("\n"), "utf8");
  console.log(
    `⚠ ${failed.length} files could not be read - see data/index-errors.txt`,
  );
}