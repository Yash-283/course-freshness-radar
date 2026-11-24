// From a list of folder names, return the highest "V<number>" folder.
// Example: ['V1','V3','V4','Archive'] -> { name: 'V4', num: 4 }
export function pickLatestVersion(folderNames) {
  const versions = folderNames
    .map((name) => {
      const match = name.trim().match(/^v(\d+)$/i); // V4, v4, V10
      return match ? { name, num: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.num - a.num); // biggest number first

  return versions[0] || null;
}

// Names that look like versions but break the rule, e.g. "V4 Final", "V5 Draft"
export function oddVersionNames(folderNames) {
  return folderNames.filter(
    (n) => /^v\d/i.test(n.trim()) && !/^v\d+$/i.test(n.trim())
  );
}