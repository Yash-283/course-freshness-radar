import path from 'node:path';
import { config } from '../config.js';

// Skip a folder if its name contains any skip word
// e.g. "Archive - AWS CP", "External Resourses", "Training Recording", "Tirthesh Kickoff"
export const isArchive = (name) => {
  const n = name.toLowerCase();
  return config.skipFolderWords.some((word) => n.includes(word));
};

// Keep only real course files: supported type, not temporary, not a copy, not empty, not too large
export function keepFile(name, size) {
  const n = name.toLowerCase();

  if (name.startsWith('~$')) return false;                              // Office temp file
  if (config.skipFileWords.some((w) => n.includes(w))) return false;     // "- Copy" duplicates
  if (!config.fileTypes.includes(path.extname(n))) return false;         // unsupported type
  if (size < 200) return false;                                          // empty / near-empty file
  if (size > config.maxFileMB * 1024 * 1024) return false;               // too large
  return true;
}