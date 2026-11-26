import { useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, FileText, CheckCircle2, XCircle, ChevronDown, ChevronRight, Bot, ThumbsUp, RotateCcw } from 'lucide-react';
import { useApi } from '../useApi.js';
import { postJson, fmtDay, shortCourse } from '../api.js';
import { go } from '../router.js';
import { ImpactBadge, StatusPill, ScoreRing, VendorIcon, FlagStatus, Loading, ErrorBox } from '../ui.jsx';

const OPEN = ['New', 'Accepted'];

// One course flag: every vendor change affecting the course, each with its places to update
export default function CourseFlag({ course, onChanged }) {
  const [reload, setReload] = useState(0);
  const [hideDone, setHideDone] = useState(true);
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState(false);
  const { data: d, error, loading } = useApi('/course-flag?status=all&course=' + encodeURIComponent(course), reload);

  if (error) return <ErrorBox error={error} />;
  if (loading && !d) return <Loading />;

  const all = d.changes.flatMap((ch) => ch.places);
  const openPlaces = all.filter((p) => OPEN.includes(p.status));
  const done = all.length - openPlaces.length;
  const openChanges = d.changes.filter((ch) => ch.places.some((p) => OPEN.includes(p.status)));

  // ids = [] → every open place of the course
  const act = async (action, ids = []) => {
    setBusy(true);
    try {
      await postJson('/course-flag/action', { course, action, ids });
      setReload((n) => n + 1);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="page">
      <button className="link-btn back" onClick={() => go('#/flags')}><ArrowLeft size={16} /> Back to course flags</button>

      {/* Course header */}
      <div className="card cflag-head">
        <ScoreRing score={d.score} size={72} />
        <div className="cflag-title">
          {course.includes(' › ') && <div className="muted small">{course.split(' › ')[0]}</div>}
          <h1>{shortCourse(course)}</h1>
          <div className="cflag-meta">
            <StatusPill status={d.scoreStatus} />
            <span><b>{openChanges.length}</b> change{openChanges.length === 1 ? '' : 's'} · <b>{openPlaces.length}</b> place{openPlaces.length === 1 ? '' : 's'} to update</span>
          </div>
          {all.length > 0 && (
            <div className="progress">
              <div className="bar"><div style={{ width: `${(done / all.length) * 100}%` }} /></div>
              <span className="muted small">{done} of {all.length} done</span>
            </div>
          )}
        </div>
        {openPlaces.length > 0 && (
          <div className="cflag-actions">
            <button className="btn btn-success" disabled={busy} onClick={() => act('Fixed')}><CheckCircle2 size={16} /> Mark all fixed</button>
            <button className="btn btn-outline" disabled={busy} onClick={() => act('Accepted', openPlaces.filter((p) => p.status === 'New').map((p) => p.id))}>
              <ThumbsUp size={15} /> Accept all
            </button>
          </div>
        )}
      </div>

      <div className="cflag-bar">
        <label className="check"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide fixed and dismissed places</label>
        <span className="muted small">Tick a place when its slide, section or lab is updated.</span>
      </div>

      {openPlaces.length === 0 && (
        <div className="card empty-done"><CheckCircle2 size={22} /> Everything in this course flag is done.</div>
      )}

      {/* One card per vendor change */}
      {d.changes.map((ch) => {
        const places = hideDone ? ch.places.filter((p) => OPEN.includes(p.status)) : ch.places;
        if (!places.length) return null;
        const openIds = ch.places.filter((p) => OPEN.includes(p.status)).map((p) => p.id);
        return (
          <div key={ch.changeId} className={`card change-group edge-top-${ch.impact}`}>
            <div className="cg-head">
              <div className="cg-title">
                <VendorIcon vendor={ch.vendor} size={18} />
                <div>
                  <div className="change-title">{ch.title}</div>
                  <div className="muted small">
                    {ch.vendor} · {fmtDay(ch.changeDate)}{ch.changeType ? ` · ${ch.changeType.replace('_', ' ')}` : ''} ·
                    {' '}{ch.places.length} place{ch.places.length === 1 ? '' : 's'}
                    {ch.link && <> · <a href={ch.link} target="_blank" rel="noopener noreferrer">Official announcement <ExternalLink size={12} /></a></>}
                  </div>
                </div>
              </div>
              <div className="cg-side">
                <ImpactBadge impact={ch.impact} />
                {openIds.length > 0 && (
                  <button className="btn btn-light btn-sm" disabled={busy} onClick={() => act('Fixed', openIds)}>
                    <CheckCircle2 size={14} /> Mark change fixed
                  </button>
                )}
              </div>
            </div>

            <div className="places">
              {places.map((p) => {
                const isDone = !OPEN.includes(p.status);
                const parts = (p.location || '').split(' › ');
                const section = parts.length > 1 ? parts.pop() : '';
                const isNew = d.lastRunStart && p.createdAt >= d.lastRunStart;
                return (
                  <div key={p.id} className={`place ${isDone ? 'done' : ''}`}>
                    <div className="place-row">
                      <input type="checkbox" title={isDone ? 'Re-open' : 'Mark fixed'} checked={p.status === 'Fixed'} disabled={busy || p.status === 'Dismissed'}
                             onChange={() => act(p.status === 'Fixed' ? 'Accepted' : 'Fixed', [p.id])} />
                      <button className="place-loc" onClick={() => toggle(p.id)}>
                        {open[p.id] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        <span>{parts.join(' › ')}{section && <> › <b>{section}</b></>}</span>
                        {isNew && !isDone && <span className="tag-new">NEW</span>}
                        {p.impact !== ch.impact && <ImpactBadge impact={p.impact} />}
                      </button>
                      {p.status !== 'New' && <FlagStatus status={p.status} />}
                      {p.fileUrl && (
                        <a className="btn btn-ghost btn-sm" href={p.fileUrl} target="_blank" rel="noopener noreferrer" title={p.fileName}>
                          <FileText size={13} /> SharePoint <ExternalLink size={12} />
                        </a>
                      )}
                    </div>

                    {open[p.id] && (
                      <div className="place-detail">
                        <div className="compare">
                          <div className="card compare-before">
                            <div className="card-title">Current text</div>
                            <blockquote>{p.currentText}</blockquote>
                          </div>
                          <div className="compare-arrow"><ArrowRight size={20} /></div>
                          <div className="card compare-after">
                            <div className="card-title"><Bot size={14} /> Suggested update · AI-drafted, please verify</div>
                            <blockquote>{p.suggestedText}</blockquote>
                          </div>
                        </div>
                        <p className="small"><b>Why:</b> {p.reason} <span className="muted">· confidence {Math.round((p.confidence || 0) * 100)}%</span></p>
                        <div className="actions">
                          {isDone
                            ? <button className="btn btn-light btn-sm" disabled={busy} onClick={() => act('Accepted', [p.id])}><RotateCcw size={14} /> Re-open</button>
                            : <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => act('Dismissed', [p.id])}><XCircle size={14} /> Dismiss – false alarm</button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
