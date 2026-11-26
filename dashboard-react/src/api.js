// Small helper for calling our Express API (/api/...)
export async function api(path, options) {
  const res = await fetch('/api' + path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const postJson = (path, data) =>
  api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data ?? {}) });

export const fmtDate = (s) =>
  s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '–';

export const fmtDay = (s) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

export const parseList = (s) => {
  try { return JSON.parse(s || '[]'); } catch { return []; }
};

// "AI Powered Coding › Claude Code for Developers" -> "Claude Code for Developers"
export const shortCourse = (c = '') => c.split(' › ').pop();
