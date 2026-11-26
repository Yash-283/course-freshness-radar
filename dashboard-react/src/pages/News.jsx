import { useMemo, useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { useApi } from '../useApi.js';
import { fmtDay, parseList, shortCourse } from '../api.js';
import { VendorIcon, Loading, ErrorBox, Empty } from '../ui.jsx';

export default function News({ reloadKey }) {
  const { data: rows, error, loading } = useApi('/news', reloadKey);
  const [filter, setFilter] = useState('all');
  const [text, setText] = useState('');

  const shown = useMemo(() => {
    if (!rows) return [];
    const t = text.trim().toLowerCase();
    return rows.filter((r) =>
      (filter === 'all' || (filter === 'relevant' ? r.relevant === 1 : r.relevant === 0)) &&
      (!t || `${r.vendor} ${r.title}`.toLowerCase().includes(t)));
  }, [rows, filter, text]);

  if (error) return <ErrorBox error={error} />;
  if (loading && !rows) return <Loading />;

  const relevantCount = rows.filter((r) => r.relevant === 1).length;

  return (
    <div className="page">
      <div className="toolbar card">
        <div className="search">
          <Search size={16} />
          <input placeholder="Search announcements…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="segmented">
          {[['all', `All (${rows.length})`], ['relevant', `Relevant (${relevantCount})`], ['not', 'Not relevant']].map(([v, l]) => (
            <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      {shown.length ? (
        <div className="card table-card">
          {shown.map((r, i) => (
            <div key={i} className="news-row">
              <div className="news-vendor"><VendorIcon vendor={r.vendor} size={18} /></div>
              <div className="news-main">
                <a href={r.link} target="_blank" rel="noopener noreferrer" className="news-title">
                  {r.title} <ExternalLink size={12} />
                </a>
                <div className="muted small">{r.vendor} · {fmtDay(r.d)}{r.changeType && r.relevant === 1 ? ` · ${r.changeType.replace('_', ' ')}` : ''}</div>
                {r.relevant === 1 && (
                  <div className="chips">{parseList(r.courses).map((c) => <span key={c} className="chip">{shortCourse(c)}</span>)}</div>
                )}
              </div>
              <div>
                {r.relevant === 1 ? <span className="pill pill-warn">Relevant</span>
                  : r.relevant === 0 ? <span className="pill pill-muted">Not relevant</span>
                  : <span className="pill pill-muted">Not triaged</span>}
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>No announcements match.</Empty>}
    </div>
  );
}
