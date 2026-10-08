import Link from 'next/link';
import { CASES, PLANNED } from '@/lib/cases';
import { listSessions, listWonders } from '@/lib/sessions';
import { StartCase } from '@/app/components/HomeActions';
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

      <h2 className="label" style={{ fontSize: 14, marginTop: 32 }}>Abi&apos;s sessions</h2>
      {real.length === 0 ? <p className="muted">None yet.</p> : (
        <div className="stack" style={{ gap: 6 }}>
          {real.map((s) => (
            <Link key={s.id} href={`/parent/session/${s.id}`}>
              {new Date(s.updatedAt).toLocaleString()} · {s.caseId === 'inquiry' ? 'Question' : `Case ${s.caseId}`}: {s.title} · {s.status}
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
