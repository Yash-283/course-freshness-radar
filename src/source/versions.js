// Turn a folder name into a version number, or null if it isn't a version folder.
// A version folder has V / Ver / Version / Rev / Revision + a number (any upper/lower case):
//   V1, v1, Version 1, V1.1, v1.1, V1.a, V2.b, V.03, Version 3, Rev 2, Rev.2d
//   also with extra words: "Claude Code for Developers Rev.2d", "V4 Final", "Version 3 (draft)"
// Not versions: "Materials", "Curriculum", "Batch April 16-17, 2026", "Review", "Server 2"
const WORD = String.raw`(?:(?:ver|version|rev|revision)\s*\.?|v)`;
const NUM = String.raw`\s*(\d*)\s*(?:\.\s*(\d+))?\s*(?:[.\s_-]?\s*([a-z]))?`;

// 1) the name is a version, or ENDS with one ("... Rev.2d")
const AT_END = new RegExp(String.raw`(?:^|[\s_-])${WORD}${NUM}$`, 'i');
// 2) a version inside a longer name ("V4 Final", "Version 3 (draft)")
const INSIDE = new RegExp(String.raw`(?:^|[\s_(\[-])${WORD}\s*(\d+)(?:\s*\.\s*(\d+))?(?:\s*\.?\s*([a-z])(?![a-z]))?(?=$|[\s_)\],.-])`, 'i');

export function parseVersion(name) {
  const clean = name.trim();
  let m = clean.match(AT_END);
  if (!m || (m[1] === '' && m[2] === undefined)) {
    m = clean.match(INSIDE);
    if (!m) return null;
  }
  return {
    name,
    major: m[1] === '' ? 0 : Number(m[1]),        // "V.03" -> 0
    minor: m[2] === undefined ? 0 : Number(m[2]), // "V1.1" -> 1, "V.03" -> 3
    letter: m[3] ? m[3].toLowerCase() : '',       // "V1.a" -> a, "Rev.2d" -> d
  };
}

// Compare two parsed versions: number, then sub-number, then letter
export const compareVersions = (a, b) =>
  a.major - b.major || a.minor - b.minor || a.letter.localeCompare(b.letter);

// "2.1a" style label for messages
export const versionLabel = (v) => `${v.major}${v.minor ? '.' + v.minor : ''}${v.letter}`;

// From a list of folder names, return the latest version (or null if none)
export function pickLatestVersion(folderNames) {
  const versions = folderNames.map(parseVersion).filter(Boolean);
  if (!versions.length) return null;
  return versions.sort(compareVersions).at(-1);
}