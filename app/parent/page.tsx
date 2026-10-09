import Link from 'next/link';
import { CASES, PLANNED } from '@/lib/cases';
import { listSessions, listWonders } from '@/lib/sessions';
import { StartCase, StartReview } from '@/app/components/HomeActions';
import { weeklyStats } from '@/lib/streak';
import SimRunner from '@/app/components/SimRunner';

export const dynamic = 'force-dynamic';

const METHOD: Record<string, string> = { challenge: 'Challenge', investigation: 'Investigation', simulation: 'Simulation', inquiry: 'Inquiry' };

export default async function Parent() {
  const [sessions, wonders] = await Promise.all([listSessions(), listWonders()]);
  const real = sessions.filter((s) => !s.isTest).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const tests = sessions.filter((s) => s.isTest).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const all = [...CASES.map((c) => ({ id: c.id, title: c.title, mode: c.mode, status: c.status, unit: c.unit, version: c.version as number | undefined })), ...PLANNED.map((p) => ({ ...p, status: 'NOT WRITTEN', version: undefined }))].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <main className="wrap" style={{ maxWidth: 960 }}>
      <div className="topbar">
        <Link href="/">← Abi&apos;s view</Link>
        <span>Parent dashboard</span>
      </div>

      <h2 className="label" style={{ fontSize: 14 }}>Unit 1 · Early Settlements</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--ink)' }}>
              <th style={{ padding: 6 }}>#</th><th>Case</th><th>Mode</th><th>Case status</th><th>Abi</th><th></th>
            </tr>
          </thead>
          <tbody>
            {all.map((c) => {
              const mine = real.filter((s) => s.caseId === c.id);
              const done = mine.find((s) => s.status === 'closed');
              const active = mine.find((s) => s.status === 'active');
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                  <td style={{ padding: 6 }}>{c.id}</td>
                  <td>{c.title}{c.version ? <span className="muted"> v{c.version}</span> : null}</td>
                  <td>{METHOD[c.mode]}</td>
                  <td>{c.status}</td>
                  <td>{done ? <Link href={`/parent/session/${done.id}`}>Completed</Link> : active ? <Link href={`/parent/session/${active.id}`}>In progress</Link> : 'Not started'}</td>
                  <td style={{ padding: 6 }}>{c.status !== 'NOT WRITTEN' && <StartCase caseId={c.id} label="Test play" test />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel row" style={{ marginTop: 16, gap: 12 }}>
        <span>📋 <strong>Supervisor review:</strong> recall questions on a whole unit. It shows up for Abi once she has closed every case in a unit. The test uses the unit of your most recent closed case.</span>
        <StartReview label="Test a review" test />
      </div>

      {(() => {
        const wk = weeklyStats(sessions);
        return (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="label" style={{ marginBottom: 8 }}>🔥 Weekly goal: {wk.goal} cases · current streak {wk.streak} week{wk.streak === 1 ? '' : 's'}</div>
            <div className="row" style={{ gap: 8 }}>
              {wk.recent.map((w, i) => (
                <div key={w.week} style={{ textAlign: 'center', minWidth: 64, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--rule)', background: w.count >= wk.goal ? '#e2f1e6' : i === 0 ? '#fdf8ea' : 'var(--card)' }}>
                  <div className="muted" style={{ fontSize: 12 }}>{i === 0 ? 'This week' : `Wk of ${new Date(w.week + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{w.count}/{wk.goal}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <h2 className="label" style={{ fontSize: 14, marginTop: 32 }}>Abi&apos;s sessions</h2>
      {real.length === 0 ? <p className="muted">None yet.</p> : (
        <div className="stack" style={{ gap: 6 }}>
          {real.map((s) => (
            <Link key={s.id} href={`/parent/session/${s.id}`}>
              {new Date(s.updatedAt).toLocaleString()} · {s.caseId === 'inquiry' ? 'Question' : s.caseId === 'review' ? '📋 Review' : `Case ${s.caseId}`}: {s.title} · {s.status}
            </Link>
          ))}
        </div>
      )}

      <h2 className="label" style={{ fontSize: 14, marginTop: 32 }}>Wonder List</h2>
      {wonders.length === 0 ? <p className="muted">Empty.</p> : (
        <ul>{wonders.map((w) => <li key={w.id}>{w.question} <span className="muted">({w.status})</span></li>)}</ul>
      )}

      <h2 className="label" style={{ fontSize: 14, marginTop: 32 }}>Simulated student test</h2>
      <p className="muted" style={{ marginTop: 0 }}>Runs a case with an AI playing a student, so you can read how the guide behaves before Abi plays.</p>
      <SimRunner cases={CASES.map((c) => ({ id: c.id, title: c.title }))} />

      {tests.length > 0 && (
        <>
          <h2 className="label" style={{ fontSize: 14, marginTop: 32 }}>Test runs</h2>
          <div className="stack" style={{ gap: 6 }}>
            {tests.slice(0, 20).map((s) => (
              <Link key={s.id} href={`/parent/session/${s.id}`}>{new Date(s.updatedAt).toLocaleString()} · {s.title} · {s.status}</Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
