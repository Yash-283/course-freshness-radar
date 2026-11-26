import { Cloud, CodeXml, Sparkles, Newspaper, LoaderCircle } from 'lucide-react';

export const IMPACT_COLORS = {
  Certification: 'var(--high)', High: 'var(--high)', Medium: 'var(--med)', Low: 'var(--low)',
};

export function ImpactBadge({ impact }) {
  return <span className={`badge impact-${impact}`}>{impact === 'Certification' ? '🎓 Certification' : impact}</span>;
}

export function StatusPill({ status }) {
  const cls = status === 'Fresh' ? 'ok' : status === 'Needs review' ? 'warn' : 'bad';
  return <span className={`pill pill-${cls}`}>{status}</span>;
}

export function FlagStatus({ status }) {
  return <span className={`flag-status st-${status}`}>{status}</span>;
}

// Circular freshness score (0-100)
export function ScoreRing({ score, size = 64, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 90 ? 'var(--low)' : score >= 70 ? 'var(--med)' : 'var(--high)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-label={`Score ${score}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-bg)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight="700" fill="var(--ink)">
        {score}
      </text>
    </svg>
  );
}

export function VendorIcon({ vendor, size = 16 }) {
  const v = (vendor || '').toLowerCase();
  if (v.includes('aws') || v.includes('amazon')) return <Cloud size={size} className="vendor-aws" />;
  if (v.includes('github')) return <CodeXml size={size} className="vendor-gh" />;
  if (v.includes('anthropic') || v.includes('claude')) return <Sparkles size={size} className="vendor-an" />;
  return <Newspaper size={size} />;
}

export function Loading({ text = 'Loading…' }) {
  return <div className="loading"><LoaderCircle className="spin" size={18} /> {text}</div>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function ErrorBox({ error }) {
  return <div className="error-box">Could not load: {String(error?.message || error)}</div>;
}
