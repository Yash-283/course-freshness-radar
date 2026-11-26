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

// One flag, full detail
function flagBlock(f, n) {
  const changeTitle = f.link ? `<a href="${esc(f.link)}">${esc(f.title)}</a>` : esc(f.title);
  return `
  <div style="border-left:4px solid ${COLOR[f.impact] || '#999'};padding:10px 14px;margin:14px 0;background:#FAF9FD;border-radius:6px">
    <div style="font-weight:700">${n}. ${ICON[f.impact] || ''} ${esc(f.impact)}: ${esc(f.location)}</div>
    <div style="font-size:13px;color:#5E5A72;margin:4px 0 8px">
      What changed: ${esc(f.vendor)} · ${esc((f.changeDate || '').slice(0, 10))} · ${changeTitle}</div>
    <div style="font-size:13px"><b>Current text:</b> “${esc(f.currentText)}”</div>
    <div style="font-size:13px;margin-top:6px"><b>Suggested update (AI-drafted, please verify):</b> ${esc(f.suggestedText)}</div>
    <div style="font-size:13px;margin-top:6px;color:#5E5A72"><b>Why:</b> ${esc(f.reason)}</div>
    <div style="margin-top:10px;font-size:13px">
      <a href="${dash()}/#/flag/${f.id}">Open in dashboard</a>
      ${f.fileUrl ? ` · <a href="${esc(f.fileUrl)}">📄 Open file in SharePoint</a>` : ''}
    </div>
  </div>`;
}

// Immediate alert: urgent flags for one recipient
export function alertEmail(flags) {
  const courses = [...new Set(flags.map((f) => f.course))];
    const subject = courses.length === 1
    ? `🔴 Course Freshness Radar: ${flags.length} urgent update${flags.length > 1 ? 's' : ''} – ${shortName(courses[0])}`
    : `🔴 Course Freshness Radar: ${flags.length} urgent updates (${courses.map(shortName).join(', ').slice(0, 80)})`;
  const body = `
    <p>Hi,</p>
    <p>Today's check found changes in official vendor sources that affect
       <b>${esc(courses.map(shortName).join(', '))}</b>. Please review the items below.</p>
    <p style="font-size:12px;color:#5E5A72">Tip: forward this email to the TPM currently responsible for this course.</p>
    ${courses.map((c) => `<h3 style="margin:20px 0 4px">${esc(c)}</h3>` +
      flags.filter((f) => f.course === c).map((f, i) => flagBlock(f, i + 1)).join('')).join('')}`;
  return { subject, html: layout(subject, body) };
}

// Weekly digest: open flags per course with the course score
export function digestEmail(courses) {
  const total = courses.reduce((s, c) => s + c.flags.length, 0);
  const subject = `📋 Course Freshness Radar weekly digest: ${total} open flag${total > 1 ? 's' : ''}`;
  const line = (f) => `<li style="margin:6px 0">${ICON[f.impact] || ''} <b>${esc(f.impact)}</b> – ${esc(f.location)}<br>
      <span style="color:#5E5A72">${esc(f.reason)}</span> · <a href="${dash()}/#/flag/${f.id}">Open</a></li>`;
  const body = `
    <p>Hi,</p><p>Here is this week's summary of open flags for your courses:</p>
    ${courses.map((c) => `
      <h3 style="margin:20px 0 4px">${esc(c.course)}</h3>
      <div style="font-size:13px;color:#5E5A72">Freshness score <b>${c.score}</b> · ${esc(c.status)}</div>
      <ul style="padding-left:18px;font-size:13px">${c.flags.map(line).join('')}</ul>`).join('')}
    <p><a href="${dash()}/#/flags">Open all flags in the dashboard</a></p>`;
  return { subject, html: layout(subject, body) };
}

// Message for the admin (errors, budget)
export function adminEmail(subject, lines) {
  return layout(subject, `<p><b>${esc(subject)}</b></p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`);
}