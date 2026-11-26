import { useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, FileText, CheckCircle2, XCircle, Wrench, Bot } from 'lucide-react';
import { useApi } from '../useApi.js';
import { postJson, fmtDate, fmtDay, shortCourse } from '../api.js';
import { go } from '../router.js';
import { ImpactBadge, FlagStatus, VendorIcon, Loading, ErrorBox } from '../ui.jsx';

export default function FlagDetail({ id, onChanged }) {
  const [reload, setReload] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const { data: f, error, loading } = useApi('/flags/' + id, reload);

  if (error && /not found/i.test(String(error?.message || error))) {
    return (
      <div className="page">
        <div className="card">
          <div className="card-title">This flag is no longer available</div>
          <p>It was removed after this email was created (for example by a demo reset or a re-check), so the link is out of date.
            If the issue still exists, the daily run has created it again as a new flag.</p>
          <button className="btn btn-primary" onClick={() => go('#/flags')}>Go to current flags</button>
        </div>
      </div>
    );
  }
  if (error) return <ErrorBox error={error} />;
  if (loading && !f) return <Loading />;

  const act = async (action) => {
    setBusy(action);
    try {
      await postJson(`/flags/${id}/action`, { action, note });
      setNote('');
      setReload((n) => n + 1);
      onChanged?.();
    } finally {
      setBusy('');
    }
  };

  const confidence = Math.round((f.confidence || 0) * 100);
  const parts = (f.location || '').split(' › ');

  return (
    <div className="page">
      <button className="link-btn back" onClick={() => go('#/flags')}><ArrowLeft size={16} /> Back to flags</button>

      <div className="detail-head card">
        <div>
          <div className="muted small">{f.course.includes(' › ') ? f.course.split(' › ')[0] : 'Course'}</div>
          <h1 className="detail-title">{shortCourse(f.course)}</h1>
          <div className="breadcrumb">{parts.map((p, i) => <span key={i}>{i > 0 && ' › '}{i === parts.length - 1 ? <b>{p}</b> : p}</span>)}</div>
        </div>
        <div className="detail-badges">
          <ImpactBadge impact={f.impact} />
          <FlagStatus status={f.status} />
          {f.isSample ? <span className="tag-sample">SAMPLE</span> : null}
          {f.fileUrl && (
            <a className="btn btn-primary btn-sp" href={f.fileUrl} target="_blank" rel="noopener noreferrer" title={f.fileName}>
              <FileText size={15} /> Open in SharePoint <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      {/* What changed */}
      <div className="card change-card">
        <div className="card-title"><VendorIcon vendor={f.vendor} /> What changed · official {f.vendor} source</div>
        <div className="change-title">{f.title}</div>
        <div className="muted small">{fmtDay(f.changeDate)}{f.changeType ? ` · ${f.changeType.replace('_', ' ')}` : ''}</div>
        {f.summary && <p className="change-summary">{f.summary.slice(0, 700)}{f.summary.length > 700 ? '…' : ''}</p>}
        {f.link && <a className="btn btn-ghost" href={f.link} target="_blank" rel="noopener noreferrer">Open official announcement <ExternalLink size={14} /></a>}
      </div>

      {/* Before → After */}
      <div className="compare">
        <div className="card compare-before">
          <div className="card-title">Current text in our course</div>
          <blockquote>{f.currentText}</blockquote>
          {f.fileUrl && (
            <a className="btn btn-ghost" href={f.fileUrl} target="_blank" rel="noopener noreferrer">
              <FileText size={14} /> Open {f.fileName || 'file'} <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="compare-arrow"><ArrowRight size={22} /></div>
        <div className="card compare-after">
          <div className="card-title"><Bot size={15} /> Suggested update · AI-drafted, please verify</div>
          <blockquote>{f.suggestedText}</blockquote>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Why it's flagged</div>
        <p>{f.reason}</p>
        <div className="confidence">
          <span className="muted small">Confidence {confidence}%</span>
          <div className="bar"><div style={{ width: `${confidence}%` }} /></div>
          <span className="muted small">Checked by {f.checkedBy || '–'}</span>
        </div>
      </div>

      {/* Review */}
      <div className="card">
        <div className="card-title">Your review</div>
        <textarea rows={2} placeholder="Optional note (e.g. why it's a false alarm, or who will fix it)"
                  value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="actions">
          <button className="btn btn-primary" disabled={!!busy} onClick={() => act('Accepted')}><CheckCircle2 size={16} /> Accept – needs update</button>
          <button className="btn btn-outline" disabled={!!busy} onClick={() => act('Dismissed')}><XCircle size={16} /> Dismiss – false alarm</button>
          <button className="btn btn-success" disabled={!!busy} onClick={() => act('Fixed')}><Wrench size={16} /> Mark fixed</button>
        </div>
        {f.history?.length > 0 && (
          <div className="timeline">
            {f.history.map((h, i) => (
              <div key={i} className="timeline-item">
                <span className="dot" />
                <div><b>{h.action}</b> · <span className="muted">{fmtDate(h.at)}</span>{h.note && <div className="muted">{h.note}</div>}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
