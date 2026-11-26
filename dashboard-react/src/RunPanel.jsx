import { useEffect, useRef, useState } from 'react';
import { FolderSearch, Newspaper, Filter, Scale, Bell, CheckCircle2, XCircle, LoaderCircle, Circle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from './api.js';
import { go } from './router.js';

// Must match the step names in src/run.js
const STEPS = [
  { name: 'Index course content (SharePoint)', label: 'SharePoint', hint: 'Re-read changed course files', icon: FolderSearch },
  { name: 'Collect vendor news', label: 'Vendor news', hint: 'AWS · GitHub · Anthropic', icon: Newspaper },
  { name: 'Triage new posts (AI)', label: 'Triage', hint: 'Claude: is it relevant?', icon: Filter },
  { name: 'Judge relevant posts (AI)', label: 'Judge', hint: 'Claude: is our content outdated?', icon: Scale },
  { name: 'Notifications', label: 'Notify', hint: 'Alerts & digest', icon: Bell },
];

// Work out each step's state from the run log
function parseSteps(log) {
  const state = STEPS.map(() => ({ status: 'pending', seconds: null }));
  for (const line of log) {
    STEPS.forEach((s, i) => {
      if (line.startsWith(`▶ ${s.name}`)) state[i].status = 'running';
      const done = line.match(new RegExp(`^(✅|❌) ${s.name.replace(/[()]/g, '\\$&')} \\((\\d+)s\\)`));
      if (done) { state[i].status = done[1] === '✅' ? 'done' : 'failed'; state[i].seconds = Number(done[2]); }
    });
  }
  return state;
}

export default function RunPanel({ open, onClose, run, onFinished }) {
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [run?.log?.length, showLog]);

  if (!open || !run) return null;
  const steps = parseSteps(run.log || []);
  const flagsFound = (run.log || []).filter((l) => l.trim().startsWith('⚑')).length;
  const lastLine = [...(run.log || [])].reverse().find((l) => l.trim()) || 'Starting…';
  const finished = !run.running && run.finishedAt;
  const newFlags = run.lastRun?.newFlags ?? 0;

  return (
    <div className="run-panel">
      <div className="run-head">
        <div>
          <div className="run-title">Daily run</div>
          <div className="run-sub">
            {run.running ? 'Running… checking SharePoint, vendor news and course content'
              : run.exitCode === 0 ? 'Finished – all steps OK' : 'Finished with errors'}
          </div>
        </div>
        <button className="icon-btn light" onClick={onClose} title="Hide"><X size={18} /></button>
      </div>

      <div className="steps">
        {STEPS.map((s, i) => {
          const st = steps[i];
          const Icon = s.icon;
          return (
            <div key={s.name} className={`step step-${st.status}`}>
              <div className="step-icon">
                {st.status === 'done' ? <CheckCircle2 size={20} />
                  : st.status === 'failed' ? <XCircle size={20} />
                  : st.status === 'running' ? <LoaderCircle size={20} className="spin" />
                  : <Circle size={20} />}
              </div>
              <div className="step-text">
                <div className="step-label"><Icon size={14} /> {s.label}</div>
                <div className="step-hint">{st.seconds != null ? `${st.seconds}s` : s.hint}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="run-activity">
        {run.running
          ? <><LoaderCircle size={14} className="spin" /> <span>{lastLine.trim().slice(0, 110)}</span></>
          : finished && (
            <div className="run-result">
              <b>{newFlags} new flag{newFlags === 1 ? '' : 's'}</b> found in this run
              {newFlags > 0 && (
                <button className="btn btn-light btn-sm" onClick={() => { go('#/flags?new=1'); onFinished?.(); }}>View new flags</button>
              )}
            </div>
          )}
        {run.running && flagsFound > 0 && <span className="run-flags">⚑ {flagsFound} post(s) with flags so far</span>}
      </div>

      <button className="log-toggle" onClick={() => setShowLog((v) => !v)}>
        {showLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showLog ? 'Hide' : 'Show'} technical log
      </button>
      {showLog && <pre className="run-log" ref={logRef}>{(run.log || []).join('\n')}</pre>}
    </div>
  );
}

// Start a run (ignores "already running")
export async function startRun() {
  try {
    await api('/run', { method: 'POST' });
  } catch (e) {
    if (!/already/i.test(e.message)) throw e;
  }
}
