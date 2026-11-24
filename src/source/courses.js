import { config } from '../config.js';
import { source } from './index.js';
import { isArchive, keepFile } from './filters.js';
import { parseVersion, pickLatestVersion, oddVersionNames } from './versions.js';

const isSlides   = (n) => /slide/i.test(n);
const isDsSlides = (n) => /\bDS\b|DS[\s-]*(format|template)/i.test(n);
const isSig      = (n) => /\bSIG\b/.test(n);

// ---- Run at most N SharePoint calls at the same time ----
function makeLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}
const limit = makeLimiter(config.concurrency);
const listContents = (ref) => limit(() => source.listContents(ref));

// ---- List courses in an area (AI has an extra category level) ----
export async function getCourses(area) {
  const top = (await listContents(area.ref)).folders.filter((f) => !isArchive(f.name));
  if (area.courseDepth === 1) return top.map((c) => ({ ...c, category: null }));

  const perCategory = await Promise.all(
    top.map(async (cat) =>
      (await listContents(cat.ref)).folders
        .filter((f) => !isArchive(f.name))
        .map((c) => ({ ...c, category: cat.name }))
    )
  );
  return perCategory.flat();
}

// ---- Pick which top-level folders of a course to check ----
export async function selectContentFolders(course, areaCfg) {
  const folders = (await listContents(course.ref)).folders.filter((f) => !isArchive(f.name));
  const names = folders.map((f) => f.name);
  const latest = pickLatestVersion(names);
  const hasDsSlides = names.some(isDsSlides);

  const keep = [];
  const skipped = [];
  for (const f of folders) {
    if (parseVersion(f.name) && f.name !== latest?.name) { skipped.push(`${f.name} (older version)`); continue; }
    if (isSig(f.name) && !areaCfg.includeSIG)            { skipped.push(`${f.name} (SIG not checked here)`); continue; }
    if (isSlides(f.name) && hasDsSlides && !isDsSlides(f.name)) { skipped.push(`${f.name} (non-DS slides)`); continue; }
    keep.push(f);
  }
  return { folders: keep, skipped };
}

// ---- Collect files inside a folder, reading only the latest version at every level ----
export async function collectFiles(ref, relPath, warnings) {
  const { folders, files } = await listContents(ref);

  const out = files
    .filter((f) => keepFile(f.name, f.size))
    .map((f) => ({ ...f, path: `${relPath}/${f.name}` }));

  const usable = folders.filter((f) => !isArchive(f.name));
  const names = usable.map((f) => f.name);
  const latest = pickLatestVersion(names);

  const odd = oddVersionNames(names);
  if (odd.length) warnings.push(`${relPath}: unusual version names: ${odd.join(', ')}`);

  // keep normal folders + only the latest version folder
  const chosen = usable.filter((f) => !parseVersion(f.name) || f.name === latest?.name);

  const nested = await Promise.all(
    chosen.map((f) => collectFiles(f.ref, `${relPath}/${f.name}`, warnings))
  );
  return out.concat(...nested);
}