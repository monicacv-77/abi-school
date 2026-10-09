import Link from 'next/link';
import { CASES } from '@/lib/cases';
import { UNITS } from '@/lib/units';
import { listSessions, listWonders } from '@/lib/sessions';
import { lookFor, modeVars } from '@/lib/look';

export const dynamic = 'force-dynamic';

const START = 1600;
const END = 1810;
const pct = (y: number) => ((y - START) / (END - START)) * 100;
const span = (u: { years: [number, number] }) => (u.years[0] === u.years[1] ? `${u.years[0]}` : `${u.years[0]}–${u.years[1]}`);

export default async function Timeline() {
  const [sessions, wonders] = await Promise.all([listSessions(), listWonders()]);
  const mine = sessions.filter((s) => !s.isTest);
  const closed = mine.filter((s) => s.status === 'closed');
  const units = [...UNITS].sort((a, b) => a.years[0] - b.years[0]);
  const unitInfo = units.map((u) => {
    const cases = CASES.filter((c) => c.unit === u.name && c.status === 'READY').sort((a, b) => a.id.localeCompare(b.id));
    const doneCount = cases.filter((c) => closed.some((s) => s.caseId === c.id)).length;
    const state = u.planned || !cases.length ? 'planned' : doneCount === cases.length ? 'done' : doneCount > 0 || mine.some((s) => cases.some((c) => c.id === s.caseId)) ? 'now' : 'next';
    return { u, cases, doneCount, state };
  });
  const asked = closed.filter((s) => s.caseId === 'inquiry').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const waiting = wonders.filter((w) => w.status === 'open');

  return (
    <main className="wrap">
      <div className="topbar">
        <Link href="/">← Dashboard</Link>
        <span>Timeline</span>
      </div>
      <h1 className="title" style={{ fontSize: 48 }}>My Timeline</h1>
      <p className="muted" style={{ marginTop: 0 }}>Where your cases happen in history, and every question you&apos;ve wondered about.</p>

      {/* Strip: the whole stretch of history, units placed by year */}
      <div className="tl-strip" aria-hidden="true">
        <div className="tl-axis" />
        {[1600, 1650, 1700, 1750, 1800].map((y) => (
          <div key={y} className="tl-tick" style={{ left: `${pct(y)}%` }}>{y}</div>
        ))}
        {unitInfo.map(({ u, state }) => (
          <div key={u.name} className={`tl-dot ${state}`} style={{ left: `${pct(u.years[0])}%`, width: `max(14px, ${pct(u.years[1]) - pct(u.years[0])}%)` }} title={`${u.title}, ${span(u)}`} />
        ))}
      </div>

      <ol className="tl-units">
        {unitInfo.map(({ u, cases, doneCount, state }, i) => {
          const gap = i > 0 ? u.years[0] - unitInfo[i - 1].u.years[1] : 0;
          return (
            <li key={u.name}>
              {gap > 5 && <div className="tl-gap">⏳ {gap} years later…</div>}
              <section className={`tl-card ${state}`}>
                <div className="tl-years">{span(u)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <h2 className="tl-title">{u.title}</h2>
                    <span className={`tl-state ${state}`}>{state === 'done' ? '🏁 Finished' : state === 'now' ? `📂 ${doneCount} of ${cases.length} closed` : state === 'next' ? '📂 Ready to start' : '🔒 Coming up'}</span>
                  </div>
                  <p style={{ margin: '2px 0 10px', color: 'var(--ink-2)' }}>{u.blurb}</p>
                  {cases.length > 0 && (
                    <div className="row" style={{ gap: 6 }}>
                      {cases.map((c) => {
                        const done = closed.find((s) => s.caseId === c.id);
                        const chip = (
                          <span className={`tl-chip${done ? ' done' : ''}`} style={modeVars(c.mode)}>
                            {lookFor(c.mode).emoji} {c.title}{done ? ' ✓' : ''}
                          </span>
                        );
                        return done ? <Link key={c.id} href={`/files/${done.id}`} style={{ textDecoration: 'none' }}>{chip}</Link> : <span key={c.id}>{chip}</span>;
                      })}
                    </div>
                  )}
                </div>
              </section>
            </li>
          );
        })}
      </ol>

      <section style={{ marginTop: 32, ...modeVars('inquiry') }}>
        <h2 className="tl-title" style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>💡 My questions</h2>
        {asked.length === 0 && waiting.length === 0 ? (
          <p className="muted">No questions yet. Ask one from the home page any time.</p>
        ) : (
          <div className="q-cloud">
            {asked.map((s) => (
              <Link key={s.id} href={`/files/${s.id}`} className="q-bubble done">✓ {s.title}</Link>
            ))}
            {waiting.map((w) => (
              <span key={w.id} className="q-bubble">✨ {w.question}</span>
            ))}
          </div>
        )}
        {(asked.length > 0 || waiting.length > 0) && <p className="muted" style={{ fontSize: 14 }}>✓ explored (tap to see what you figured out) · ✨ still on your Wonder List</p>}
      </section>
    </main>
  );
}
