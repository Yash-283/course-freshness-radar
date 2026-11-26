import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { useApi } from '../useApi.js';
import { fmtDate, parseList } from '../api.js';
import { Loading, ErrorBox, Empty } from '../ui.jsx';

const TYPE_LABEL = { alert: '🔴 Alert', digest: '📋 Digest', admin: '⚙️ Admin', budget: '💲 Budget' };

// Links inside the preview must open in a new browser tab: most sites
// (AWS, SharePoint) refuse to load inside the small preview frame.
function openLinksInNewTab(h) {
  const base = '<base target="_blank">';
  return /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => m + base) : base + h;
}

export default function Emails({ reloadKey }) {
  const { data: rows, error, loading } = useApi('/notifications', reloadKey);
  const [selected, setSelected] = useState(null);

  const [html, setHtml] = useState('');
  useEffect(() => { if (rows?.length && !selected) setSelected(rows[0].id); }, [rows, selected]);
  useEffect(() => {
    if (!selected) return;
    fetch(`/api/notifications/${selected}/html`).then((r) => r.text()).then((h) => setHtml(openLinksInNewTab(h))).catch(() => setHtml('Preview not available'));
  }, [selected]);

  if (error) return <ErrorBox error={error} />;
  if (loading && !rows) return <Loading />;
  if (!rows.length) return <div className="page"><Empty>No emails yet. They are created by the daily run (or "npm run notify").</Empty></div>;

  return (
    <div className="page">
      {rows[0]?.mode === 'preview' && (
        <div className="notice">Preview mode – emails are generated but not sent. Sending is switched on with Amazon SES at deployment.</div>
      )}
      <div className="emails">
        <div className="card email-list">
          {rows.map((r) => (
            <button key={r.id} className={`email-item ${selected === r.id ? 'active' : ''}`} onClick={() => setSelected(r.id)}>
              <div className="email-top"><span>{TYPE_LABEL[r.type] || r.type}</span><span className="muted small">{fmtDate(r.at)}</span></div>
              <div className="email-subject">{r.subject}</div>
              <div className="muted small"><Mail size={12} /> {r.recipients} · {parseList(r.flagIds).length} flag(s)</div>
            </button>
          ))}
        </div>
        <div className="card email-preview">
          {selected && (
            <iframe title="Email preview" srcDoc={html}
                    sandbox="allow-popups allow-popups-to-escape-sandbox" />
          )}
        </div>
      </div>
    </div>
  );
}
