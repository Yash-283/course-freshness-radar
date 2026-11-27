import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, X, Copy, Check, Trash2, Search, LoaderCircle } from 'lucide-react';
import { api, postJson } from './api.js';

// Ask Radar: read-only chat over Radar's own data (search, summaries, drafting, explanations)
const SUGGESTIONS = [
  'Where do we mention Sonnet 4.5 in our courses?',
  'Which courses are at risk, and why?',
  "Summarise this month's Claude changes that affect our courses",
  'Draft an email to the TPM of the course with the most urgent issues',
];

// ---- tiny, safe markdown: **bold**, `code`, [text](link), "- " bullets, "1. " lists ----
function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0; let m; let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2]) out.push(<b key={`${keyBase}-${k++}`}>{m[2]}</b>);
    else if (m[3]) out.push(<code key={`${keyBase}-${k++}`}>{m[3]}</code>);
    else {
      const href = m[5];
      if (href.startsWith('#/')) out.push(<a key={`${keyBase}-${k++}`} href={href}>{m[4]}</a>);
            else if (/^https?:\/\//i.test(href) || /^\/open\/\d+$/.test(href)) out.push(<a key={`${keyBase}-${k++}`} href={href} target="_blank" rel="noopener noreferrer">{m[4]}</a>);
      else out.push(m[4]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }) {
  const blocks = [];
  let list = null;
  const clean = text
    .replace(/\]\s*\n\s*\(/g, '](')                                   // "[text]\n(url)" → "[text](url)"
    .replace(/(^|\s)(https?:\/\/[^\s)<]+)/g, (m, pre, url) => `${pre}[Open link](${url})`); // bare URL → short link
  clean.split('\n').forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (bullet || num) {
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) { list = { type, items: [] }; blocks.push(list); }
      list.items.push(inline((bullet || num)[1], `l${i}`));
      return;
    }
    list = null;
    if (!line.trim()) return;
    const h = line.match(/^#{1,4}\s+(.*)/);
    blocks.push(h ? { type: 'h', content: inline(h[1], `h${i}`) } : { type: 'p', content: inline(line, `p${i}`) });
  });
  return blocks.map((b, i) => {
    if (b.type === 'ul') return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
    if (b.type === 'ol') return <ol key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ol>;
    if (b.type === 'h') return <p key={i} className="chat-h">{b.content}</p>;
    return <p key={i}>{b.content}</p>;
  });
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="chat-icon-btn" title="Copy answer" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); });
    }}>{done ? <Check size={14} /> : <Copy size={14} />}</button>
  );
}

export default function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([]);   // { role, content, used?, error? }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const loadStatus = () => api('/chat/status').then(setStatus).catch(() => {});
  useEffect(() => { if (open) { loadStatus(); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...messages.filter((m) => !m.error), { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const r = await postJson('/chat', { messages: next.map(({ role, content }) => ({ role, content })) });
      setMessages([...next, { role: 'assistant', content: r.answer, used: r.used }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: e.message, error: true }]);
    } finally {
      setBusy(false);
      loadStatus();
    }
  };

  if (!open) return null;
  return (
    <aside className="chat-panel" role="dialog" aria-label="Ask Radar">
      <div className="chat-head">
        <div className="chat-title"><Sparkles size={17} /> Ask Radar <span className="chat-badge">read-only</span></div>
        <div className="chat-head-actions">
          {messages.length > 0 && <button className="chat-icon-btn" title="New conversation" onClick={() => setMessages([])}><Trash2 size={15} /></button>}
          <button className="chat-icon-btn" title="Close" onClick={onClose}><X size={17} /></button>
        </div>
      </div>

      <div className="chat-list" ref={listRef}>
        {!messages.length && (
          <div className="chat-empty">
            <p>Ask about our courses, findings and vendor news. Answers use <b>only Radar's data</b>, with links.</p>
            <div className="chat-suggest">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role} ${m.error ? 'error' : ''}`}>
            {m.role === 'user' ? m.content : (
              <>
                <div className="chat-md"><Markdown text={m.content} /></div>
                {!m.error && (
                  <div className="chat-meta">
                    {m.used?.length > 0 && <span className="chat-used"><Search size={11} /> {m.used.join(' · ')}</span>}
                    <CopyButton text={m.content} />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {busy && <div className="chat-msg assistant thinking"><LoaderCircle size={14} className="spin" /> Looking it up in Radar…</div>}
      </div>

      <div className="chat-input">
        <textarea ref={inputRef} rows={2} placeholder="e.g. Where do we mention Cowork?" value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn btn-primary" disabled={busy || !input.trim()} onClick={() => send()} title="Send"><Send size={16} /></button>
      </div>
      <div className="chat-foot">
        {status ? `${status.questionsToday}/${status.dailyLimit} questions today · $${status.spent.toFixed(2)} of $${status.cap.toFixed(2)} this month` : ' '}
        <span> · AI-drafted text: please verify</span>
      </div>
    </aside>
  );
}