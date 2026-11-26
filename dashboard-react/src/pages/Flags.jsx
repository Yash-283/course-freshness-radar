import { useMemo, useState } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { useApi } from '../useApi.js';
import { go } from '../router.js';
import { fmtDay, shortCourse } from '../api.js';
import { ImpactBadge, ScoreRing, VendorIcon, Loading, ErrorBox, Empty } from '../ui.jsx';

// ONE flag per course: every affected place is listed inside the course flag
const IMPACTS = ['', 'Certification', 'High', 'Medium', 'Low'];
const RANK = { Certification: 0, High: 1, Medium: 2, Low: 3 };

export const courseHash = (course) => '#/course?c=' + encodeURIComponent(course);

export default function Flags({ query, reloadKey }) {
  const impact = query.get('impact') || '';
  const onlyNew = query.get('new') === '1';
  const [text, setText] = useState('');
  const { data, error, loading } = useApi('/course-flags' + (onlyNew ? '?new=1' : ''), reloadKey);

  const setImpact = (i) => {
    const p = new URLSearchParams(onlyNew ? { new: '1' } : {});
    if (i) p.set('impact', i);
    go('#/flags' + (p.toString() ? '?' + p : ''));
  };

  const shown = useMemo(() => {
    let rows = data?.courses || [];
    // impact filter: course flags that contain at least one change of this impact
    if (impact) rows = rows.filter((c) => c.changes.some((ch) => ch.impact === impact));
    const t = text.trim().toLowerCase();
    if (t) rows = rows.filter((c) => `${c.course} ${c.changes.map((ch) => ch.title).join(' ')}`.toLowerCase().includes(t));
    return rows;
  }, [data, impact, text]);

  const places = shown.reduce((s, c) => s + c.places, 0);

  return (
    <div className="page">
      {onlyNew && (
        <div className="notice">
          Showing course flags with places found in the latest run.
          <button className="link-btn" onClick={() => go('#/flags')}>Show all course flags</button>
        </div>
      )}

      <div className="toolbar card">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search course or announcement…" value={text} onChange={(e) => setText(e.target.value)} />
          {text && <button className="icon-btn" onClick={() => setText('')}><X size={14} /></button>}
        </div>
        <div className="segmented">
          {IMPACTS.map((i) => (
            <button key={i || 'all'} className={impact === i ? 'active' : ''} onClick={() => setImpact(i)}>{i || 'All'}</button>
          ))}
        </div>
      </div>

      {error && <ErrorBox error={error} />}
      {loading && !data && <Loading />}
      {data && (
        <>
          <div className="muted small list-count">
            {shown.length} course flag{shown.length === 1 ? '' : 's'} · {places} place{places === 1 ? '' : 's'} to update
          </div>
          {shown.length ? shown.map((c) => (
            <button key={c.course} className={`flag-row cflag-row edge-${c.impact}`} onClick={() => go(courseHash(c.course))}>
              <ScoreRing score={c.score} size={48} stroke={5} />
              <div className="flag-main">
                <div className="flag-course">
                  {shortCourse(c.course)}
                  {c.newPlaces > 0 && <span className="tag-new">{c.newPlaces} NEW</span>}
                  {c.isSample ? <span className="tag-sample">SAMPLE</span> : null}
                </div>
                <div className="flag-loc">
                  <b>{c.changes.length}</b> change{c.changes.length === 1 ? '' : 's'} · <b>{c.places}</b> place{c.places === 1 ? '' : 's'} to update
                  {c.accepted > 0 && <> · {c.accepted} accepted</>} · last found {fmtDay(c.latest)}
                </div>
                <div className="change-chips">
                  {[...c.changes].sort((a, b) => RANK[a.impact] - RANK[b.impact]).slice(0, 4).map((ch, i) => (
                    <span key={i} className={`chip chip-${ch.impact}`}>
                      <VendorIcon vendor={ch.vendor} size={12} /> {ch.title}<b> · {ch.places}</b>
                    </span>
                  ))}
                  {c.changes.length > 4 && <span className="chip">+{c.changes.length - 4} more</span>}
                </div>
              </div>
              <div className="flag-side"><ImpactBadge impact={c.impact} /></div>
              <ChevronRight size={18} className="muted" />
            </button>
          )) : <Empty>{onlyNew ? 'The latest run found nothing new.' : 'No open course flags 🎉'}</Empty>}
        </>
      )}
    </div>
  );
}
