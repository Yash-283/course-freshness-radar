// Turn a folder name into a version number, or null if it isn't a version folder.
// Handles: V1, v2, V10, V0.1, V0.2, V.03, V2.a, V2.b
export function parseVersion(name) {
  const m = name.trim().match(/^v\s*(\d*)\s*(?:\.\s*(\d+))?\s*(?:[.\s_-]?\s*([a-z]))?$/i);
  if (!m || (m[1] === '' && m[2] === undefined)) return null;
  return {
    name,
    major: m[1] === '' ? 0 : Number(m[1]),        // "V.03" -> major 0
    minor: m[2] === undefined ? 0 : Number(m[2]), // "V0.2" -> 2, "V.03" -> 3
    letter: m[3] ? m[3].toLowerCase() : '',       // "V2.b" -> b
  };
}

const compare = (a, b) =>
  a.major - b.major || a.minor - b.minor || a.letter.localeCompare(b.letter);

// From a list of folder names, return the latest version (or null if none)
export function pickLatestVersion(folderNames) {
  const versions = folderNames.map(parseVersion).filter(Boolean);
  if (!versions.length) return null;
  return versions.sort(compare).at(-1);
}

// Names that start like a version but don't follow the pattern, e.g. "V4 Final"
export function oddVersionNames(folderNames) {
  return folderNames.filter((n) => /^v\s*\.?\d/i.test(n.trim()) && !parseVersion(n));
}