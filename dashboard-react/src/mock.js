// PROTOTYPE ONLY: fake API with sample data, used when built with VITE_MOCK=1.
// The real dashboard never includes this file's data.
const now = Date.now();
const iso = (d) => new Date(now - d * 864e5).toISOString();

const raw = [
  ['Artificial Intelligence', 'AI Powered Coding › Advanced Claude Code', 19, 979],
  ['Artificial Intelligence', 'AI Powered Coding › Advanced GitHub Copilot for Developers', 25, 558],
  ['Artificial Intelligence', 'AI Powered Coding › Claude Code & Claude API-From Prompts to Production', 1, 4],
  ['Artificial Intelligence', 'AI Powered Coding › Claude Code for Developers', 104, 2031],
  ['Artificial Intelligence', 'AI Powered Coding › Claude Code Foundations', 28, 478],
  ['Artificial Intelligence', 'AI Powered Coding › Claude for Business & Product Teams', 60, 704],
  ['Artificial Intelligence', 'AI Powered Coding › Coding Foundations for Non-Technical Professionals', 16, 187],
  ['Artificial Intelligence', 'AI Powered Coding › GItHub Copilot', 17, 263],
  ['Cloud Computing (AWS)', 'AWS CDEA', 71, 1725],
  ['Cloud Computing (AWS)', 'AWS CSAA', 14, 574],
  ['Cloud Computing (AWS)', 'AWS CSAP', 47, 2021],
  ['Cloud Computing (AWS)', 'AWS Cloud Practitioner', 51, 1008],
];

const CHANGES = {
  c1: { vendor: 'Anthropic', title: '[Sample] Claude Code command renamed', days: 6, type: 'renamed' },
  c2: { vendor: 'Anthropic', title: '[Sample] Older model deprecated, retirement scheduled', days: 12, type: 'removed' },
  c3: { vendor: 'AWS', title: '[Sample] Updated Solutions Architect Professional exam announced', days: 30, type: 'certification' },
  c4: { vendor: 'GitHub', title: '[Sample] Copilot code review billing will default to the organization', days: 1, type: 'behaviour_change' },
  c5: { vendor: 'Anthropic', title: '[Sample] API now enforces a prefix check on all accounts', days: 20, type: 'behaviour_change' },
  c6: { vendor: 'Anthropic', title: '[Sample] Turn-scoped system messages available in beta', days: 40, type: 'new_feature' },
};
const CCD = 'AI Powered Coding › Claude Code for Developers';
const OLD_MODEL = ['For the strongest reasoning, switch to the older model with /model.', 'Recommend the current model instead; note that the older model is deprecated and will be retired.', 'The material recommends a model the vendor has announced for retirement.'];
const RENAMED = ['Run /old-command to summarise the conversation.', 'Run /new-command to summarise the conversation (renamed in the latest release).', 'The command shown here was renamed in a recent Claude Code release.'];

// [id, changeId, course, location, impact, [current, suggested, why], status, foundDaysAgo]
let flags = [
  [1, 'c2', CCD, 'Slides/CCD - Module 1.pptx › Slide 21', 'High', OLD_MODEL, 'New', 0.01],
  [2, 'c2', CCD, 'Slides/CCD - Module 2.pptx › Slide 8', 'High', OLD_MODEL, 'New', 0.01],
  [3, 'c2', CCD, 'Reference Book/Claude Code for Developers.md › 1.4.2 Configuration and Model Commands', 'High', OLD_MODEL, 'New', 0.01],
  [4, 'c1', CCD, 'Ready for WL/Lab 2 - Sessions.docx › Step 3', 'Medium', RENAMED, 'New', 1],
  [5, 'c1', 'AI Powered Coding › Claude Code Foundations', 'Slides/CCF - Module 2.pptx › Slide 14', 'Medium', RENAMED, 'New', 1],
  [6, 'c1', 'AI Powered Coding › Claude Code Foundations', 'Ready for WL/Lab 1.docx › Step 4', 'Medium', RENAMED, 'Fixed', 1],
  [7, 'c2', 'AI Powered Coding › Advanced Claude Code', 'Slides/ACC - Module 1.pptx › Slide 5', 'High', OLD_MODEL, 'New', 2],
  [8, 'c2', 'AI Powered Coding › Advanced Claude Code', 'Reference Book/Advanced Claude Code.md › 3.1.1 When to Decompose', 'Medium', OLD_MODEL, 'New', 2],
  [9, 'c5', 'AI Powered Coding › Advanced Claude Code', 'Reference Book/Advanced Claude Code.md › Hybrid pipeline orchestration (part 2)', 'Medium',
    ['Prefill the assistant turn with any text to steer the output format.', 'Prefill still works, but note the new prefix check that now applies to every account.', 'A behaviour change in the API affects how this example behaves.'], 'New', 2],
  [10, 'c3', 'AWS CSAP', 'Curriculum/CSAP Curriculum.pdf › Part 1', 'Certification',
    ['This course prepares learners for the AWS Certified Solutions Architect – Professional exam (current version).', 'Update the exam version and exam-guide domains to match the newly announced exam.', 'The certification announcement introduces an updated exam version.'], 'New', 0.01],
  [11, 'c4', 'AI Powered Coding › Advanced GitHub Copilot for Developers', 'Reference Book/V6/Advanced Copilot.md › 4.3.2 Required Status Checks', 'Medium',
    ['Copilot code review usage is billed to the individual developer’s plan.', 'Copilot code review usage is billed to the organization by default.', 'The default billing owner changes, so this statement is outdated.'], 'Accepted', 0.01],
  [12, 'c4', 'AI Powered Coding › Advanced GitHub Copilot for Developers', 'Slides/AGC - Module 4.pptx › Slide 11', 'Medium',
    ['Each developer pays for their own Copilot code reviews.', 'Code review usage is billed to the organization by default; admins can change this.', 'Same billing change, shown on the slide.'], 'New', 0.01],
  [13, 'c6', 'AI Powered Coding › Claude Code & Claude API-From Prompts to Production', 'Curriculum/Course Curriculum.docx › Module 3', 'Low',
    ['Module 3 covers system prompts and how they shape responses.', 'Add a short note on turn-scoped system messages (beta) in Module 3.', 'A new capability is worth a mention in the system-prompts module.'], 'New', 40],
  // found by the simulated "Run now"
  [14, 'c1', CCD, 'Slides/CCD - Module 3.pptx › Slide 14', 'Medium', RENAMED, 'Hidden', 0],
].map(([id, changeId, course, location, impact, [current, suggested, reason], status, found]) => {
  const ch = CHANGES[changeId];
  return { id, changeId, course, location, impact, current, suggested, reason, status, isSample: 0,
    confidence: 0.72 + (id % 3) * 0.08, createdAt: iso(found), vendor: ch.vendor, title: ch.title, type: ch.type, changeDate: iso(ch.days) };
});

const history = { 11: [{ action: 'Accepted', note: 'Forwarded to the course TPM', at: iso(0.005) }] };
let lastRun = { startedAt: iso(0.02), status: 'ok', newFlags: 5, aiCost: 0.006 };
let run = { running: false, startedAt: null, finishedAt: null, exitCode: null, log: [] };

const RANK = { Certification: 0, High: 1, Medium: 2, Low: 3 };
const higher = (a, b) => (RANK[a] <= RANK[b] ? a : b);
const W = { Certification: 15, High: 15, Medium: 8, Low: 3 };
const isOpen = (f) => ['New', 'Accepted'].includes(f.status);
const visible = () => flags.filter((f) => f.status !== 'Hidden');

function scoreFor(course) {
  const per = new Map();
  for (const f of flags.filter((x) => x.course === course && isOpen(x))) per.set(f.changeId, per.has(f.changeId) ? higher(f.impact, per.get(f.changeId)) : f.impact);
  const imp = [...per.values()];
  const score = Math.max(0, 100 - imp.reduce((s, i) => s + W[i], 0));
  return { score, status: score >= 90 ? 'Fresh' : score >= 70 ? 'Needs review' : 'At risk', imp,
    places: flags.filter((x) => x.course === course && isOpen(x)).length };
}

function overview() {
  const courses = raw.map(([area, course, files, chunks]) => {
    const s = scoreFor(course);
    return { area, course, files, chunks, high: s.imp.filter((i) => RANK[i] <= 1).length, medium: s.imp.filter((i) => i === 'Medium').length,
      low: s.imp.filter((i) => i === 'Low').length, changes: s.imp.length, places: s.places, open: s.places, score: s.score, status: s.status };
  });
  return { courses, totals: { files: 453, chunks: 10532, news: 327, relevantNews: 46, lastIndexed: iso(0) }, ai: { spent: 0.13, cap: 4.5 }, lastRun };
}

function courseFlags(onlyNew) {
  const map = new Map();
  for (const f of flags.filter(isOpen)) {
    if (!map.has(f.course)) map.set(f.course, { course: f.course, impact: f.impact, places: 0, newPlaces: 0, accepted: 0, isSample: 0, latest: '', changes: new Map() });
    const g = map.get(f.course);
    g.places++; if (f.createdAt >= lastRun.startedAt) g.newPlaces++; if (f.status === 'Accepted') g.accepted++;
    if (f.createdAt > g.latest) g.latest = f.createdAt;
    g.impact = higher(f.impact, g.impact);
    const ch = g.changes.get(f.changeId) || { title: f.title, vendor: f.vendor, impact: f.impact, places: 0 };
    ch.impact = higher(f.impact, ch.impact); ch.places++;
    g.changes.set(f.changeId, ch);
  }
  let list = [...map.values()].map((g) => ({ ...g, changes: [...g.changes.values()], score: scoreFor(g.course).score, scoreStatus: scoreFor(g.course).status }));
  if (onlyNew) list = list.filter((g) => g.newPlaces > 0);
  list.sort((a, b) => RANK[a.impact] - RANK[b.impact] || b.places - a.places);
  return { lastRunStart: lastRun.startedAt, courses: list };
}

function courseFlag(course) {
  const s = scoreFor(course);
  const changes = new Map();
  for (const f of visible().filter((x) => x.course === course).sort((a, b) => a.location.localeCompare(b.location))) {
    if (!changes.has(f.changeId)) {
      changes.set(f.changeId, { changeId: f.changeId, title: f.title, vendor: f.vendor, link: 'https://example.com', changeType: f.type,
        changeDate: f.changeDate, impact: f.impact, places: [] });
    }
    const ch = changes.get(f.changeId);
    ch.impact = higher(f.impact, ch.impact);
    ch.places.push({ id: f.id, location: f.location, impact: f.impact, status: f.status, confidence: f.confidence, currentText: f.current,
      suggestedText: f.suggested, reason: f.reason, fileUrl: 'https://example.com', fileName: f.location.split(' › ')[0].split('/').pop(), createdAt: f.createdAt, isSample: 0 });
  }
  return { course, score: s.score, scoreStatus: s.status, lastRunStart: lastRun.startedAt,
    changes: [...changes.values()].sort((a, b) => RANK[a.impact] - RANK[b.impact]) };
}

const news = [
  ['AWS', 'AWS Backup adds incremental backups for DynamoDB', 0, 1, ['AWS CSAA', 'AWS CSAP']],
  ['GitHub', 'Copilot code review billing will default to the organization', 1, 1, ['Advanced GitHub Copilot for Developers', 'GItHub Copilot']],
  ['Anthropic', 'Claude Code release with renamed command', 2, 1, ['Claude Code Foundations', 'Claude Code for Developers']],
  ['AWS', 'New Local Zone launched', 3, 0, []],
  ['AWS', 'New instance types in two more regions', 4, 0, []],
  ['Anthropic', 'Older model deprecated, retirement scheduled', 12, 1, ['Claude Code for Developers', 'Advanced Claude Code']],
  ['GitHub', 'Dependabot UI refresh', 14, 0, []],
  ['AWS', 'Updated Solutions Architect Professional exam announced', 30, 1, ['AWS CSAP']],
].map(([vendor, title, d, relevant, courses]) => ({ vendor, source: 'sample', title: `[Sample] ${title}`, link: 'https://example.com', d: iso(d), relevant, courses: JSON.stringify(courses), changeType: 'behaviour_change' }));

const notifications = [
  { id: 1, at: iso(0.01), type: 'alert', recipients: 'you@company.com', subject: '🔴 Course Freshness Radar: AWS CSAP – 1 place to update', flagIds: '[10]', mode: 'preview' },
  { id: 2, at: iso(0.01), type: 'alert', recipients: 'you@company.com', subject: '🔴 Course Freshness Radar: Claude Code for Developers – 3 places to update', flagIds: '[1,2,3]', mode: 'preview' },
  { id: 3, at: iso(3), type: 'digest', recipients: 'you@company.com', subject: '📋 Course Freshness Radar weekly digest: 6 courses, 12 places to update', flagIds: '[1,2,3,4,5,7,8,9,10,11,12,13]', mode: 'preview' },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function emailHtml(n) {
  const list = JSON.parse(n.flagIds).map((id) => flags.find((f) => f.id === id)).filter(Boolean);
  return `<!DOCTYPE html><html><body style="margin:0;background:#F6F5FA;font-family:Segoe UI,Arial,sans-serif;color:#1A1530">
  <div style="max-width:640px;margin:0 auto;padding:20px"><div style="background:#4B2A8C;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:700">Course Freshness Radar</div>
  <div style="background:#fff;padding:18px;border:1px solid #E4E1EC;border-top:0;border-radius:0 0 10px 10px;font-size:14px">
  <p>Hi,</p><p>${n.type === 'digest' ? "Here is this week's summary of open flags:" : 'Today’s check found changes in official vendor sources that affect this course. Please review:'}</p>
  ${list.map((f, i) => `<div style="border-left:4px solid ${f.impact === 'Medium' ? '#B86E0A' : f.impact === 'Low' ? '#2E7D4F' : '#C8303F'};padding:10px 14px;margin:12px 0;background:#FAF9FD;border-radius:6px">
    <b>${i + 1}. ${esc(f.impact)}: ${esc(f.location)}</b><div style="font-size:13px;color:#5E5A72;margin:4px 0">${esc(f.vendor)} · ${esc(f.title)}</div>
    <div style="font-size:13px"><b>Current text:</b> “${esc(f.current)}”</div>
    <div style="font-size:13px;margin-top:6px"><b>Suggested update (AI-drafted, please verify):</b> ${esc(f.suggested)}</div></div>`).join('')}
  <p style="color:#5E5A72;font-size:12px;border-top:1px solid #E4E1EC;padding-top:10px">Prototype sample email. AI-drafted suggestions must be checked against the official source.</p>
  </div></div></body></html>`;
}

const LOG = [
  '=== Course Freshness Radar daily run ===', '▶ Index course content (SharePoint)', 'Finding course files...', '453 files found → 0 new or changed, 453 unchanged (skipped)',
  '✅ Index course content (SharePoint) (4s)', '▶ Collect vendor news', '  ✅ aws-whats-new: 100 posts, 6 new', '  ✅ github-changelog: 10 posts, 1 new', '  ✅ claude-code: 30 posts, 1 new',
  '✅ Collect vendor news (2s)', '▶ Triage new posts (AI)', '8 posts to triage with claude-haiku (10 per call)', '  Triaged 8/8', 'Relevant: 2', '✅ Triage new posts (AI) (3s)',
  '▶ Judge relevant posts (AI)', '  ⚑ [Sample] Claude Code command renamed: 9 excerpts checked, 1 flag(s)', '  ✓ [Sample] AWS Backup: 6 excerpts checked, 0 flag(s)',
  '✅ Judge relevant posts (AI) (4s)', '▶ Notifications', '  Alerts: nothing new to send', '✅ Notifications (1s)', '=== Done in 0.3 min · all steps OK ===',
];

function startRun() {
  if (run.running) return false;
  run = { running: true, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, log: [] };
  let i = 0;
  const t = setInterval(() => {
    if (i < LOG.length) { run.log.push(LOG[i++]); return; }
    clearInterval(t);
    const f = flags.find((x) => x.id === 14);
    f.createdAt = run.startedAt; f.status = 'New';
    lastRun = { startedAt: run.startedAt, status: 'ok', newFlags: 1, aiCost: 0.004 };
    Object.assign(run, { running: false, finishedAt: new Date().toISOString(), exitCode: 0 });
  }, 450);
  return true;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function installMock() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, opts = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    if (!url.pathname.startsWith('/api')) return realFetch(input, opts);
    const p = url.pathname.slice(4);
    const method = (opts.method || 'GET').toUpperCase();
    await new Promise((r) => setTimeout(r, 120));

    if (p === '/overview') return json(overview());
    if (p === '/flags') {
      const q = url.searchParams;
      let rows = visible();
      if (q.get('course')) rows = rows.filter((f) => f.course === q.get('course'));
      if (q.get('impact')) rows = rows.filter((f) => f.impact === q.get('impact'));
      const st = q.get('status') || 'open';
      if (st === 'open') rows = rows.filter((f) => ['New', 'Accepted'].includes(f.status));
      else if (st !== 'all') rows = rows.filter((f) => f.status === st);
      if (q.get('new') === '1') rows = rows.filter((f) => f.createdAt >= lastRun.startedAt);
      const order = { Certification: 0, High: 1, Medium: 2, Low: 3 };
      return json([...rows].sort((a, b) => order[a.impact] - order[b.impact]));
    }
    const m = p.match(/^\/flags\/(\d+)(\/action)?$/);
    if (m) {
      const f = flags.find((x) => x.id === Number(m[1]));
      if (!f) return json({ error: 'Flag not found' }, 404);
      if (m[2] && method === 'POST') {
        const { action, note } = JSON.parse(opts.body || '{}');
        f.status = action;
        (history[f.id] ||= []).unshift({ action, note: note || '', at: new Date().toISOString() });
        return json({ ok: true });
      }
      return json({ ...f, link: 'https://example.com', summary: `${f.title.replace('[Sample] ', '')}. (Sample announcement text for the prototype.)`,
        changeType: f.type, reason: f.reason, currentText: f.current, suggestedText: f.suggested,
        checkedBy: f.impact === 'High' ? 'claude-haiku + claude-sonnet' : 'claude-haiku', fileUrl: 'https://example.com', fileName: f.location.split(' › ')[0].split('/').pop(),
        history: history[f.id] || [] });
    }
    if (p === '/course-flags') return json(courseFlags(url.searchParams.get('new') === '1'));
    if (p === '/course-flag') return json(courseFlag(url.searchParams.get('course') || ''));
    if (p === '/course-flag/action' && method === 'POST') {
      const { course, action, ids } = JSON.parse(opts.body || '{}');
      const targets = ids?.length ? ids : flags.filter((f) => f.course === course && isOpen(f)).map((f) => f.id);
      for (const id of targets) { const f = flags.find((x) => x.id === id); if (f) f.status = action; }
      return json({ ok: true, updated: targets.length });
    }
    if (p === '/news') return json(news);
    if (p === '/notifications') return json(notifications);
    const n = p.match(/^\/notifications\/(\d+)\/html$/);
    if (n) return new Response(emailHtml(notifications.find((x) => x.id === Number(n[1]))), { headers: { 'Content-Type': 'text/html' } });
    if (p === '/run' && method === 'POST') return startRun() ? json({ ok: true }) : json({ error: 'A run is already in progress' }, 409);
    if (p === '/run/status') return json({ ...run, lastRun: run.running ? null : lastRun });
    return json({ error: 'Not found' }, 404);
  };
}
