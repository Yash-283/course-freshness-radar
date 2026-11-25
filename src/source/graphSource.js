
import { ConfidentialClientApplication } from '@azure/msal-node';

import { config } from '../config.js';

import { isArchive, keepFile } from './filters.js';


const GRAPH = 'https://graph.microsoft.com/v1.0';
const env = process.env;


// Stop early with a clear message if a setting is missing
for (const key of ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET',
                   'GRAPH_DRIVE_ID', 'AI_COURSES_FOLDER_ID',
                   'AWS_COURSES_FOLDER_ID']) {
  if (!env[key]) throw new Error(`Missing ${key} in .env`);
}
const driveId = env.GRAPH_DRIVE_ID;


// 1) The tool's identity (Entra ID app) - gets access tokens
const msal = new ConfidentialClientApplication({
  auth: {
    clientId: env.GRAPH_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${env.GRAPH_TENANT_ID}`,
    clientSecret: env.GRAPH_CLIENT_SECRET,
  },
});


async function getToken() {
  // msal reuses the token until it expires (~1 hour)
  const result = await msal.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  return result.accessToken;
}


// 2) One helper for every Graph call: adds the token, waits if throttled
async function graphFetch(url, { raw = false } = {}, attempt = 1) {
  const token = await getToken();
  const res = await fetch(url.startsWith('http') ? url : GRAPH + url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429 || res.status === 503) {              // "too many requests"
    if (attempt > 5) throw new Error(`Graph throttled too many times: ${url}`);
    const wait = Number(res.headers.get('Retry-After') || 5);
    console.log(`  ⏳ Graph asked us to wait ${wait}s...`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return graphFetch(url, { raw }, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph ${res.status} on ${url}: ${body.slice(0, 300)}`);
  }

  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}


// 3) List everything inside a folder (handles multiple pages)
async function listChildren(itemId) {
  const items = [];
  let url = `/drives/${driveId}/items/${itemId}/children` +
            `?$select=id,name,size,folder,file,cTag,lastModifiedDateTime,webUrl&$top=200`;

  while (url) {
    const page = await graphFetch(url);
    items.push(...page.value);
    url = page['@odata.nextLink']; // next page, if any
  }

  return items;
}


// ---- The same 4 functions as localSource.js ----


export async function getAreas() {
  return config.areas.map((a) => ({ name: a.name, ref: env[a.idEnv] }));
}


export async function listFolders(ref) {
  const children = await listChildren(ref);
  return children
    .filter((i) => i.folder && !isArchive(i.name))
    .map((i) => ({ name: i.name, ref: i.id }));
}


export async function listFilesRecursive(ref, relPath = '') {
  const out = [];
  for (const item of await listChildren(ref)) {
    const rel = relPath ? `${relPath}/${item.name}` : item.name;

    if (item.folder) {
      if (!isArchive(item.name)) out.push(...(await listFilesRecursive(item.id, rel)));
      continue;
    }
    if (!item.file || !keepFile(item.name, item.size)) continue;

    out.push({
      id: item.id,
      name: item.name,
      path: rel,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      cTag: item.cTag, // real content tag from SharePoint
    });
  }

  return out;
}


export async function readFile(file) {
  return graphFetch(`/drives/${driveId}/items/${file.id}/content`, { raw: true });
}


// Folders and files directly inside one folder (one Graph call)
export async function listContents(ref) {
  const items = await listChildren(ref);
  return {
    folders: items.filter((i) => i.folder).map((i) => ({ name: i.name, ref: i.id })),
    files: items.filter((i) => i.file).map((i) => ({
      id: i.id,
      name: i.name,
      size: i.size,
      lastModified: i.lastModifiedDateTime,
      cTag: i.cTag,
      webUrl: i.webUrl,   // link that opens the file in SharePoint
    })),
  };
}
