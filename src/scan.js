import fs from 'node:fs';
import { config } from './config.js';
import { source } from './source/index.js';
import { getCourses, selectContentFolders, collectFiles } from './source/courses.js';

const report = [];
const log = (line = '') => report.push(line);
const started = Date.now();

console.log(`Reading from: ${config.source.toUpperCase()}`);
log(`Reading from: ${config.source.toUpperCase()}`);
let totalCourses = 0;
let totalFiles = 0;

for (const area of await source.getAreas()) {
  const areaCfg = config.areas.find((a) => a.name === area.name);
  console.log(`\n=== ${area.name} ===`);
  log(`\n=== ${area.name} ===`);

  let courses;
  try {
    courses = await getCourses({ ...area, ...areaCfg });
  } catch (err) {
    console.log(`  ⚠ Cannot read ${area.name}: ${err.message}`);
    continue;
  }

  for (const course of courses) {
    totalCourses++;
    const label = course.category ? `${course.category} › ${course.name}` : course.name;
    process.stdout.write(`  Scanning ${label} ... `);

    const warnings = [];
    const { folders, skipped } = await selectContentFolders(course, areaCfg);
    const perFolder = await Promise.all(
      folders.map((f) => collectFiles(f.ref, f.name, warnings))
    );
    const files = perFolder.flat();
    totalFiles += files.length;
    console.log(`${files.length} files`);

    log(`\nCourse: ${label}`);
    log(`  ✅ Checking: ${folders.map((f) => f.name).join(', ') || '(nothing)'}`);
    if (skipped.length) log(`  ⏭  Skipping: ${skipped.join(', ')}`);
    for (const w of warnings) log(`  ⚠ ${w}`);
    for (const f of files) log(`     - ${f.path}  (${Math.round(f.size / 1024)} KB)`);
    log(`  → ${files.length} files`);
  }
}

const seconds = Math.round((Date.now() - started) / 1000);
const summary = `Summary: ${totalCourses} courses, ${totalFiles} files to check (${seconds}s)`;
log(`\n${summary}`);
fs.writeFileSync('scan.txt', report.join('\n'), 'utf8');
console.log(`\n${summary}\nDetails saved to scan.txt`);