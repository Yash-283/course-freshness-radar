import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Flag, Newspaper, Mail, Play, LoaderCircle, Radar } from 'lucide-react';
import { useRoute } from './router.js';
import { useApi } from './useApi.js';
import { api, fmtDate } from './api.js';
import RunPanel, { startRun } from './RunPanel.jsx';
import Overview from './pages/Overview.jsx';
import Flags from './pages/Flags.jsx';
import FlagDetail from './pages/FlagDetail.jsx';
import CourseFlag from './pages/CourseFlag.jsx';
import News from './pages/News.jsx';
import Emails from './pages/Emails.jsx';

const NAV = [
  { hash: '#/', key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { hash: '#/flags', key: 'flags', label: 'Flags', icon: Flag },
  { hash: '#/news', key: 'news', label: 'Vendor news', icon: Newspaper },
  { hash: '#/emails', key: 'emails', label: 'Emails', icon: Mail },
];

const TITLES = { overview: 'Overview', flags: 'Flags', flag: 'Flag detail', course: 'Course flag', news: 'Vendor news', emails: 'Emails' };

export default function App() {
  const { path, query } = useRoute();
  const [reloadKey, setReloadKey] = useState(0);
  const overview = useApi('/overview', reloadKey);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // ---- Run now ----
  const [run, setRun] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const timer = useRef(null);

  const poll = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const s = await api('/run/status');
      setRun(s);
      if (s.running) timer.current = setTimeout(poll, 1500);
      else refresh(); // run finished → reload everything
    } catch {
      timer.current = setTimeout(poll, 3000);
    }
  }, [refresh]);

  // Reconnect if a run is already in progress when the page opens
  useEffect(() => {
    api('/run/status').then((s) => { if (s.running) { setRun(s); setPanelOpen(true); poll(); } }).catch(() => {});
    return () => clearTimeout(timer.current);
  }, [poll]);

  const onRunNow = async () => {
    setPanelOpen(true);
    setRun({ running: true, log: [], startedAt: new Date().toISOString() });
    try {
      await startRun();
      poll();
    } catch (e) {
      setRun({ running: false, finishedAt: new Date().toISOString(), exitCode: 1, log: [`Could not start: ${e.message}`] });
    }
  };

  // ---- Which page ----
  const page = path === '/course' ? 'course' : path.startsWith('/flag/') ? 'flag' : path.startsWith('/flags') ? 'flags'
    : path === '/news' ? 'news' : path === '/emails' ? 'emails' : 'overview';

  const ai = overview.data?.ai;
  const lastRun = overview.data?.lastRun;
  const spendPct = ai ? Math.min(100, (ai.spent / ai.cap) * 100) : 0;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Radar size={22} /></div>
          <div>
            <div className="brand-name">Course Freshness Radar</div>
            <div className="brand-sub">Digi-Safari</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.key === page || (n.key === 'flags' && (page === 'flag' || page === 'course'));
            return (
              <a key={n.key} href={n.hash} className={active ? 'active' : ''}>
                <Icon size={18} /> {n.label}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          {ai && (
            <div className="spend">
              <div className="spend-top"><span>AI spend this month</span><b>${ai.spent.toFixed(2)} / ${ai.cap.toFixed(2)}</b></div>
              <div className="bar light"><div style={{ width: `${spendPct}%` }} /></div>
            </div>
          )}
          <div className="sidebar-note">Reads SharePoint (read-only) · official vendor sources · Claude AI</div>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div>
            <div className="topbar-title">{TITLES[page]}</div>
            <div className="muted small">
              {lastRun ? `Last daily run ${fmtDate(lastRun.startedAt)} · ${lastRun.status === 'ok' ? '✅ OK' : '❌ errors'}` : 'No run yet'}
            </div>
          </div>
          <button className="btn btn-primary" onClick={onRunNow} disabled={run?.running}>
            {run?.running ? <><LoaderCircle size={16} className="spin" /> Running…</> : <><Play size={16} /> Run now</>}
          </button>
        </header>

        {import.meta.env.VITE_MOCK === '1' && (
          <div className="proto-bar">Prototype · sample data only – not connected to SharePoint or the real database</div>
        )}
        <main>
          {page === 'overview' && <Overview overview={overview} />}
          {page === 'flags' && <Flags query={query} overview={overview} reloadKey={reloadKey} />}
          {page === 'course' && <CourseFlag key={query.get('c')} course={query.get('c') || ''} onChanged={refresh} />}
          {page === 'flag' && <FlagDetail key={path} id={path.split('/')[2]} onChanged={refresh} />}
          {page === 'news' && <News reloadKey={reloadKey} />}
          {page === 'emails' && <Emails reloadKey={reloadKey} />}
        </main>
      </div>

      <RunPanel open={panelOpen} run={run} onClose={() => setPanelOpen(false)} onFinished={() => setPanelOpen(false)} />
    </div>
  );
}
