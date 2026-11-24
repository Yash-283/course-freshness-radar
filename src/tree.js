import { source } from './source/index.js';

// How many levels deep to show (default 3). Run: node src/tree.js 4
const MAX_DEPTH = Number(process.argv[2] || 3);

async function walk(ref, depth, indent) {
  if (depth > MAX_DEPTH) return;
  let folders;
  try {
    folders = await source.listFolders(ref);
  } catch (err) {
    console.log(`${indent}⚠ ${err.message}`);
    return;
  }
  for (const f of folders) {
    console.log(`${indent}📁 ${f.name}`);
    await walk(f.ref, depth + 1, indent + '    ');
  }
}

for (const area of await source.getAreas()) {
  console.log(`\n=== ${area.name} ===`);
  await walk(area.ref, 1, '  ');
}