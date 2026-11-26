const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dash = () => (process.env.DASHBOARD_URL || 'http://localhost:3100').replace(/\/$/, '');
const COLOR = { High: '#C8303F', Certification: '#C8303F', Medium: '#B86E0A', Low: '#2E7D4F' };
const ICON = { High: '🔴', Certification: '🎓', Medium: '🟠', Low: '🟢' };
const shortName = (course) => course.split(' › ').pop();

// Common frame for every email
function layout(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F6F5FA;font-family:Segoe UI,Arial,sans-serif;color:#1A1530">
<div style="max-width:680px;margin:0 auto;padding:24px">
  <div style="background:#4B2A8C;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">
    Course Freshness Radar</div>
  <div style="background:#fff;padding:20px;border:1px solid #E4E1EC;border-top:0;border-radius:0 0 10px 10px;font-size:14px">
    ${body}
    <p style="color:#5E5A72;font-size:12px;margin-top:24px;border-top:1px solid #E4E1EC;padding-top:12px">
      Automated message from Course Freshness Radar (Digi-Safari). AI-drafted suggestions must be checked
      against the official vendor source before changing course material.</p>
  </div>
</div></body></html>`;
}

const RANK = { Certification: 0, High: 1, Medium: 2, Low: 3 };
const courseLink = (course) => `${dash()}/#/course?c=${encodeURIComponent(course)}`;

// Group the places of one course by vendor change (highest impact first)
function byChange(places) {
  const map = new Map();
  for (const p of places) {
    if (!map.has(p.changeId)) map.set(p.changeId, { ...p, impact: p.impact, places: [] });
    const g = map.get(p.changeId);
    if ((RANK[p.impact] ?? 9) < (RANK[g.impact] ?? 9)) g.impact = p.impact;
    g.places.push(p);
  }
  return [...map.values()].sort((a, b) => (RANK[a.impact] ?? 9) - (RANK[b.impact] ?? 9));
}

const changeHead = (g, n) => {
  const t = g.link ? `<a href="${esc(g.link)}">${esc(g.title)}</a>` : esc(g.title);
  return `<div style="font-weight:700">${n}. ${ICON[g.impact] || ''} ${esc(g.impact)}: ${t}</div>
    <div style="font-size:13px;color:#5E5A72;margin:2px 0 8px">${esc(g.vendor)} · ${esc((g.changeDate || '').slice(0, 10))} ·
      ${g.places.length} place${g.places.length > 1 ? 's' : ''} to update</div>`;
};

// One place (slide / section / lab step), full detail
function placeBlock(p, n) {
  return `
    <div style="border-top:1px solid #E4E1EC;padding:8px 0 4px;font-size:13px">
      <div style="font-weight:600">☐ ${n}. ${esc(p.location)}
        ${p.fileUrl ? ` · <a href="${esc(p.fileUrl)}">📄 Open in SharePoint</a>` : ''}</div>
      <div style="margin-top:4px"><b>Current text:</b> “${esc(p.currentText)}”</div>
      <div style="margin-top:4px"><b>Suggested update (AI-drafted, please verify):</b> ${esc(p.suggestedText)}</div>
      <div style="margin-top:4px;color:#5E5A72"><b>Why:</b> ${esc(p.reason)}</div>
    </div>`;
}

// One course flag: every change and every place in that course
function courseBlock(course, places, { detail, scoreLine = '' }) {
  const groups = byChange(places);
  return `
  <h3 style="margin:22px 0 4px">${esc(course)}</h3>
  <div style="font-size:13px;color:#5E5A72;margin-bottom:6px">${scoreLine}${groups.length} change${groups.length > 1 ? 's' : ''} ·
    ${places.length} place${places.length > 1 ? 's' : ''} to update ·
    <a href="${courseLink(course)}">Open this course flag in the dashboard</a></div>
  ${groups.map((g, i) => `
    <div style="border-left:4px solid ${COLOR[g.impact] || '#999'};padding:10px 14px;margin:12px 0;background:#FAF9FD;border-radius:6px">
      ${changeHead(g, i + 1)}
      ${detail
        ? g.places.map((p, j) => placeBlock(p, j + 1)).join('')
        : `<ul style="margin:4px 0 0;padding-left:18px;font-size:13px">${g.places.map((p) => `<li style="margin:3px 0">${esc(p.location)}${
            p.fileUrl ? ` · <a href="${esc(p.fileUrl)}">SharePoint</a>` : ''}</li>`).join('')}</ul>`}
    </div>`).join('')}`;
}

// Immediate alert: urgent places, one course flag per course
export function alertEmail(flags) {
  const courses = [...new Set(flags.map((f) => f.course))];
  const n = flags.length;
  const subject = courses.length === 1
    ? `🔴 Course Freshness Radar: ${shortName(courses[0])} – ${n} place${n > 1 ? 's' : ''} to update`
    : `🔴 Course Freshness Radar: ${n} places to update (${courses.map(shortName).join(', ').slice(0, 80)})`;
  const body = `
    <p>Hi,</p>
    <p>Today's check found changes in official vendor sources that affect
       <b>${esc(courses.map(shortName).join(', '))}</b>. Everything to update is listed below, grouped by change.</p>
    <p style="font-size:12px;color:#5E5A72">Tip: forward this email to the TPM currently responsible for this course.</p>
    ${courses.map((c) => courseBlock(c, flags.filter((f) => f.course === c), { detail: true })).join('')}`;
  return { subject, html: layout(subject, body) };
}

// Weekly digest: one course flag per course, with the course score
export function digestEmail(courses) {
  const total = courses.reduce((s, c) => s + c.flags.length, 0);
  const subject = `📋 Course Freshness Radar weekly digest: ${courses.length} course${courses.length > 1 ? 's' : ''}, ${total} place${total > 1 ? 's' : ''} to update`;
  const body = `
    <p>Hi,</p><p>Here is this week's summary of open course flags:</p>
    ${courses.map((c) => courseBlock(c.course, c.flags,
      { detail: false, scoreLine: `Freshness score <b>${c.score}</b> (${esc(c.status)}) · ` })).join('')}
    <p><a href="${dash()}/#/flags">Open all course flags in the dashboard</a></p>`;
  return { subject, html: layout(subject, body) };
}

// Message for the admin (errors, budget)
export function adminEmail(subject, lines) {
  return layout(subject, `<p><b>${esc(subject)}</b></p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`);
}