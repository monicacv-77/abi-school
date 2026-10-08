import Link from 'next/link';
import { getCase } from '@/lib/cases';
import { listSessions, listWonders, nextCase } from '@/lib/sessions';
import { AskDoor, ExploreWonder, StartCase } from './components/HomeActions';

export const dynamic = 'force-dynamic';

const METHOD: Record<string, string> = { challenge: 'Challenge', investigation: 'Investigation', simulation: 'Simulation', inquiry: 'Inquiry' };

export default async function Home() {
  const [{ active, next }, sessions, wonders] = await Promise.all([nextCase(), listSessions(), listWonders()]);
  const closed = sessions.filter((s) => s.status === 'closed' && !s.isTest).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeCase = active ? getCase(active.caseId) : undefined;
  const openWonders = wonders.filter((w) => w.status === 'open');

  return (
    <main className="wrap">
      <div className="topbar">
        <span>Abi&apos;s Case Files</span>
        <span className="row" style={{ gap: 16 }}>
          <Link href="/timeline">Timeline</Link>
          <Link href="/files">Archive</Link>
        </span>
      </div>

      <section className="panel stack" style={{ borderColor: 'var(--ink)', borderWidth: 2 }}>
        {active && activeCase ? (
          <>
            <div className="label">Open case</div>
            <div>
              <span className="tag">{activeCase.classification}</span>
              <span className="tag">{METHOD[activeCase.mode]}</span>
            </div>
            <h1 className="title" style={{ fontSize: 48 }}>Case {activeCase.id}: {activeCase.title}</h1>
            <div><Link className="btn" href={`/case/${active.id}`}>Pick up where you left off</Link></div>
          </>
        ) : next ? (
          <>
            <div className="label">Today&apos;s case</div>
            <div>
              <span className="tag">{next.classification}</span>
              <span className="tag">{METHOD[next.mode]}</span>
            </div>
            <h1 className="title" style={{ fontSize: 48 }}>Case {next.id}: {next.title}</h1>
            <div><StartCase caseId={next.id} label="Open the file" /></div>
          </>
        ) : (
          <>
            <div className="label">Today&apos;s case</div>
            <p style={{ margin: 0 }}>No new case yet. The next file is still being written. Ask a question below instead.</p>
          </>
        )}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <AskDoor />
      </section>

      {openWonders.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="label" style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 6, marginBottom: 10 }}>Wonder List</div>
          <div className="stack" style={{ gap: 10 }}>
            {openWonders.map((w) => (
              <div key={w.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ flex: '1 1 300px' }}>{w.question}</span>
                <ExploreWonder id={w.id} question={w.question} />
              </div>
            ))}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="label" style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 6, marginBottom: 10 }}>Closed cases</div>
          <div className="stack" style={{ gap: 8 }}>
            {closed.slice(0, 6).map((s) => (
              <Link key={s.id} href={`/files/${s.id}`}>{s.caseId === 'inquiry' ? 'Question' : `Case ${s.caseId}`}: {s.title}</Link>
            ))}
          </div>
        </section>
      )}

      <p style={{ marginTop: 40 }}><Link href="/parent" className="muted" style={{ fontSize: 14 }}>Parent dashboard</Link></p>
    </main>
  );
}
