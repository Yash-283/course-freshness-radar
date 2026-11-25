
import fs from "node:fs";
import { source } from "./source/index.js";
import { discoverCourses } from "./discover.js";
import { extractChunks } from "./extract/index.js";
import { db } from "./db/db.js";


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
for (const r of stale) {
  deleteChunks.run(r.id);
  deleteFile.run(r.id);
}


const totals = db.prepare("SELECT COUNT(*) AS n FROM chunks").get().n;
const seconds = Math.round((Date.now() - started) / 1000);
console.log(
  `\n\nDone in ${seconds}s: ${chunkCount} chunks added this run, ${stale.length} old files removed, ${totals} chunks in total`,
);


if (failed.length) {
  fs.writeFileSync("data/index-errors.txt", failed.join("\n"), "utf8");
  console.log(
    `⚠ ${failed.length} files could not be read - see data/index-errors.txt`,
  );
}
