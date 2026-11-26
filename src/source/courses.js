import { config } from '../config.js';
import { source } from './index.js';
import { isArchive, keepFile } from './filters.js';
import { parseVersion, pickLatestVersion, compareVersions, versionLabel } from './versions.js';

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
// If the course has version folders (V1, V1.1, Version 3, Rev.2d ...), a version folder is the
// COMPLETE course (slides, reference book, labs ...):
//   1. NAME: take the highest-numbered version folder
//   2. EMPTY: if it has nothing in it yet, take the next one down
//   3. CREATED DATE: confirm it is also the newest-created version folder (if not: warning, name still wins)
//   4. read ONLY that folder – older versions AND Materials / Curriculum / Batch ... are skipped
// If the course has no version folders, every folder is read as before.
const day = (d) => (d ? String(d).slice(0, 10) : '?');

export async function selectContentFolders(course, areaCfg) {
  const folders = (await listContents(course.ref)).folders.filter((f) => !isArchive(f.name));
  const warnings = [];
  const skipped = [];

  const versions = folders
    .map((f) => ({ ...f, v: parseVersion(f.name) }))
    .filter((f) => f.v)
    .sort((a, b) => compareVersions(b.v, a.v));          // highest first

  // ---- No version folders: read everything (with the SIG / DS-slides rules) ----
  if (!versions.length) {
    const names = folders.map((f) => f.name);
    const hasDsSlides = names.some(isDsSlides);
    const keep = [];
    for (const f of folders) {
      if (isSig(f.name) && !areaCfg.includeSIG)                   { skipped.push(`${f.name} (SIG not checked here)`); continue; }
      if (isSlides(f.name) && hasDsSlides && !isDsSlides(f.name)) { skipped.push(`${f.name} (non-DS slides)`); continue; }
      keep.push(f);
    }
    return { folders: keep, skipped, warnings, latest: null };
  }

  // ---- 1 + 2: highest number that is not empty ----
  let chosen = versions.find((f) => f.childCount !== 0);
  for (const f of versions) {
    if (f === chosen) break;
    skipped.push(`${f.name} (empty – nothing uploaded yet)`);
  }
  if (!chosen) {                                         // every version folder is empty
    warnings.push(`all version folders are empty (${versions.map((f) => f.name).join(', ')}) – nothing to check`);
    return { folders: [], skipped, warnings, latest: null };
  }

  // ---- 3: confirm with the CREATED date (name still decides) ----
  for (const f of versions) {
    if (f === chosen || f.childCount === 0 || !f.created || !chosen.created) continue;
    if (f.created > chosen.created) {
      warnings.push(`"${f.name}" (version ${versionLabel(f.v)}, created ${day(f.created)}) was created AFTER ` +
        `"${chosen.name}" (version ${versionLabel(chosen.v)}, created ${day(chosen.created)}). ` +
        `Still reading "${chosen.name}" because it has the higher number – please check the folder names.`);
    }
  }

  // ---- 4: read only the chosen version folder ----
  for (const f of folders) {
    if (f === chosen || f.name === chosen.name) continue;
    if (f.v || parseVersion(f.name)) {
      if (!skipped.some((s) => s.startsWith(`${f.name} (`))) skipped.push(`${f.name} (older version, created ${day(f.created)})`);
    } else {
      skipped.push(`${f.name} (a version folder exists)`);
    }
  }
  return { folders: [chosen], skipped, warnings, latest: chosen.name, latestCreated: chosen.created };
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

  // keep normal folders + only the latest version folder
  const chosen = usable.filter((f) => !parseVersion(f.name) || f.name === latest?.name);

  const nested = await Promise.all(
    chosen.map((f) => collectFiles(f.ref, `${relPath}/${f.name}`, warnings))
  );
  return out.concat(...nested);
}