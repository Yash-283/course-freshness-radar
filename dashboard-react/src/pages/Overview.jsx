import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Newspaper, Flag, GraduationCap, Activity } from 'lucide-react';
import { ScoreRing, StatusPill, Loading, ErrorBox, Empty } from '../ui.jsx';
import { fmtDate, shortCourse } from '../api.js';
import { go } from '../router.js';

function Kpi({ icon: Icon, value, label, tone }) {
  return (
    <div className={`kpi ${tone || ''}`}>
      <div className="kpi-icon"><Icon size={18} /></div>
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

export default function Overview({ overview }) {
  const { data: d, error, loading } = overview;
  if (error) return <ErrorBox error={error} />;
  if (loading && !d) return <Loading />;

  const courses = d.courses;
  const places = courses.reduce((s, c) => s + (c.places ?? c.open), 0);
  const open = places;
  const flagged = courses.filter((c) => (c.places ?? c.open) > 0).length;
  const urgent = courses.reduce((s, c) => s + c.high, 0);
  const attention = courses.filter((c) => c.status !== 'Fresh');
  const areas = [...new Set(courses.map((c) => c.area))];

  const byCourse = courses
    .filter((c) => c.open > 0)
    .sort((a, b) => b.open - a.open)
    .map((c) => ({ name: shortCourse(c.course), 'High / Cert': c.high, Medium: c.medium, Low: c.low }));

  const totals = [
    { name: 'High / Certification', value: urgent, color: '#C8303F' },
    { name: 'Medium', value: courses.reduce((s, c) => s + c.medium, 0), color: '#C27A12' },
    { name: 'Low', value: courses.reduce((s, c) => s + c.low, 0), color: '#2E7D4F' },
  ].filter((t) => t.value > 0);

  return (
    <div className="page">
      {/* Summary banner */}
      <div className={`banner ${attention.length ? 'banner-warn' : 'banner-ok'}`}>
        {attention.length ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
        <div>
          <div className="banner-title">
            {attention.length
              ? `${attention.length} course${attention.length > 1 ? 's' : ''} need attention · ${urgent} urgent change${urgent === 1 ? '' : 's'}`
              : 'All monitored courses are fresh'}
          </div>
          <div className="banner-sub">
            {d.lastRun
              ? `Last daily run ${fmtDate(d.lastRun.startedAt)} · ${d.lastRun.status === 'ok' ? 'all steps OK' : 'had errors'} · ${d.lastRun.newFlags} new place(s) found`
              : 'No daily run recorded yet — click "Run now"'}
          </div>
        </div>
        {open > 0 && <button className="btn btn-light" onClick={() => go('#/flags')}>Review course flags <ChevronRight size={16} /></button>}
      </div>

      {/* KPIs */}
      <div className="kpis">
        <Kpi icon={Flag} value={`${flagged} / ${courses.length}`} label="Courses flagged" tone={flagged ? 'kpi-bad' : ''} />
        <Kpi icon={FileText} value={places} label="Places to update" />
        <Kpi icon={GraduationCap} value={urgent} label="High / cert changes" />
        <Kpi icon={Newspaper} value={`${d.totals.relevantNews} / ${d.totals.news}`} label="Relevant vendor posts" />
        <Kpi icon={Activity} value={`${d.totals.files} · ${d.totals.chunks.toLocaleString()}`} label="Files · chunks indexed" />
      </div>

      {/* Charts */}
      <div className="charts">
        <div className="card chart-card">
          <div className="card-title">Open changes by course</div>
          {byCourse.length ? (
            <ResponsiveContainer width="100%" height={Math.max(180, byCourse.length * 38 + 50)}>
              <BarChart data={byCourse} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="High / Cert" stackId="a" fill="#C8303F" />
                <Bar dataKey="Medium" stackId="a" fill="#C27A12" />
                <Bar dataKey="Low" stackId="a" fill="#2E7D4F" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty>No open flags 🎉</Empty>}
        </div>
        <div className="card chart-card">
          <div className="card-title">Open changes by impact</div>
          {totals.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={totals} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {totals.map((t) => <Cell key={t.name} fill={t.color} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty>No open flags</Empty>}
        </div>
      </div>

      {/* Course cards */}
      {areas.map((area) => (
        <section key={area}>
          <h2 className="section-title">{area}</h2>
          <div className="course-grid">
            {courses.filter((c) => c.area === area).map((c) => (
              <button key={c.course} className="course-card" onClick={() => go((c.places ?? c.open) > 0 ? '#/course?c=' + encodeURIComponent(c.course) : '#/flags')}>
                <ScoreRing score={c.score} />
                <div className="course-body">
                  <div className="course-name">{shortCourse(c.course)}</div>
                  {c.course.includes(' › ') && <div className="course-cat">{c.course.split(' › ')[0]}</div>}
                  <div className="course-meta">
                    <StatusPill status={c.status} />
                    {(c.places ?? 0) > 0 && <span className="count">{c.places} place{c.places === 1 ? '' : 's'}</span>}
                    {c.high > 0 && <span className="count count-high">{c.high} high</span>}
                    {c.medium > 0 && <span className="count count-med">{c.medium} med</span>}
                    {c.low > 0 && <span className="count count-low">{c.low} low</span>}
                  </div>
                  <div className="muted small">{c.files} files · {c.chunks.toLocaleString()} chunks</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
