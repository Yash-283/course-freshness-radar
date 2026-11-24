import path from 'node:path';
import { config } from '../config.js';

// Folders like "Archive", "Old", "Backup" are always skipped
export const isArchive = (name) =>
  config.archiveNames.includes(name.trim().toLowerCase());

// Keep only supported, non-temporary, not-too-large files
export function keepFile(name, size) {
  if (name.startsWith('~$')) return false;                              // Office temp file
  if (!config.fileTypes.includes(path.extname(name).toLowerCase())) return false;
  if (size > config.maxFileMB * 1024 * 1024) return false;              // too large
  return true;
}