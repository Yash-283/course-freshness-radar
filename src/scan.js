import { config } from './config.js';
import { source } from './source/index.js';
import { pickLatestVersion, oddVersionNames } from './source/versions.js';

console.log(`Reading from: ${config.source.toUpperCase()}`);

for (const area of await source.getAreas()) {
  console.log(`\n=== ${area.name} ===`);

  let courses;
  try {
    courses = await source.listFolders(area.ref);
  } catch (err) {
    console.log(`  ⚠ Cannot read ${area.name}: ${err.message}`);
    continue;
  }

  for (const course of courses) {
    const versionFolders = await source.listFolders(course.ref);
    const names = versionFolders.map((v) => v.name);
    const latest = pickLatestVersion(names);

    console.log(`\nCourse: ${course.name}`);
    console.log(`  Version folders: ${names.join(', ') || '(none)'}`);

    const odd = oddVersionNames(names);
    if (odd.length) console.log(`  ⚠ Check naming: ${odd.join(', ')}`);

    if (!latest) {
      console.log('  ⚠ No V folder found - skipping');
      continue;
    }

    console.log(`  ✅ Reading latest: ${latest.name}`);
    const latestFolder = versionFolders.find((v) => v.name === latest.name);
    const files = await source.listFilesRecursive(latestFolder.ref, latest.name);

    for (const f of files) {
      console.log(`     - ${f.path}  (${Math.round(f.size / 1024)} KB)`);
    }
    if (!files.length) console.log('     (no supported files found)');
  }
}