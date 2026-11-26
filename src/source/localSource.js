import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { isArchive, keepFile } from './filters.js';

// The two allowed top folders
export async function getAreas() {
  return config.areas.map((a) => ({ name: a.name, ref: path.join(config.localRoot, a.name) }));
}

// Sub-folders inside a folder
export async function listFolders(ref) {
  const entries = await fs.readdir(ref, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !isArchive(e.name))
    .map((e) => ({ name: e.name, ref: path.join(ref, e.name) }));
}

// All files inside a folder and its sub-folders
export async function listFilesRecursive(ref, relPath = '') {
  const out = [];
  const entries = await fs.readdir(ref, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(ref, e.name);
    const rel = relPath ? `${relPath}/${e.name}` : e.name;

    if (e.isDirectory()) {
      if (!isArchive(e.name)) out.push(...(await listFilesRecursive(full, rel)));
      continue;
    }
    const stat = await fs.stat(full);
    if (!keepFile(e.name, stat.size)) continue;

    out.push({
      id: full,
      name: e.name,
      path: rel,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      cTag: `${stat.size}-${Math.round(stat.mtimeMs)}`, // stand-in for Graph cTag
    });
  }
  return out;
}

// File contents
export async function readFile(file) {
  return fs.readFile(file.id);
}
// Folders and files directly inside one folder
export async function listContents(ref) {
  const entries = await fs.readdir(ref, { withFileTypes: true });
  const folders = [];
  const files = [];
  for (const e of entries) {
    const full = path.join(ref, e.name);
    if (e.isDirectory()) {
      const s = await fs.stat(full);
      const born = s.birthtimeMs > 0 ? s.birthtime : s.ctime; // some systems have no birth time
      const childCount = (await fs.readdir(full)).length;
      folders.push({ name: e.name, ref: full, created: born.toISOString(), childCount });
    } else {
      const s = await fs.stat(full);
      files.push({
        id: full,
        name: e.name,
        size: s.size,
        lastModified: s.mtime.toISOString(),
        cTag: `${s.size}-${Math.round(s.mtimeMs)}`,
      });
    }
  }
  return { folders, files };
}