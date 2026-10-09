import Link from 'next/link';
import { getCase } from '@/lib/cases';
import { listSessions, listWonders, nextCase, reviewStatus } from '@/lib/sessions';
import { AskDoor, ExploreWonder, StartCase, StartReview } from './components/HomeActions';
import { lookFor, modeVars } from '@/lib/look';
import type { CaseDef } from '@/lib/types';

export const dynamic = 'force-dynamic';

function CaseCard({ c, kicker, action }: { c: CaseDef; kicker: string; action: React.ReactNode }) {
  const look = lookFor(c.mode);
  return (
    <section className="panel" style={{ borderColor: 'var(--accent)', borderWidth: 2, ...modeVars(c.mode) }}>
      <div className={c.image ? 'case-hero' : undefined}>
        {c.image && <img src={c.image.src} alt={c.image.alt} style={{ objectFit: c.image.fit ?? 'cover', objectPosition: c.image.position, background: '#e9e1cf' }} />}
        <div className="stack" style={{ gap: 8 }}>
          <div className="label" style={{ color: 'var(--accent-ink)' }}>{kicker}</div>
          <div>
            <span className="tag mode"><span aria-hidden="true">{look.emoji}</span> {look.name}: {look.tagline}</span>
          </div>
          <h1 className="title" style={{ fontSize: 36, margin: 0 }}>Case {c.id}: {c.title}</h1>
          <div>{action}</div>
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  const [{ active, next }, sessions, wonders, rev] = await Promise.all([nextCase(), listSessions(), listWonders(), reviewStatus()]);
  const activeReview = sessions.filter((s) => s.caseId === 'review' && s.status === 'active' && !s.isTest).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const closed = sessions.filter((s) => s.status === 'closed' && !s.isTest && s.caseId !== 'review').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeCase = active ? getCase(active.caseId) : undefined;
  const openWonders = wonders.filter((w) => w.status === 'open');

  return (
    <main className="wrap">
      <div className="topbar">
        <span>Abi&apos;s Case Files</span>
        <span className="row" style={{ gap: 16 }}>
          <Link href="/timeline">🕰️ Timeline</Link>
          <Link href="/files">🗂️ Archive</Link>
        </span>
      </div>

      {active && activeCase ? (
        <CaseCard c={activeCase} kicker="📂 Open case" action={<Link className="btn" href={`/case/${active.id}`}>Pick up where you left off</Link>} />
      ) : next ? (
        <CaseCard c={next} kicker="📂 Today's case" action={<StartCase caseId={next.id} label="Open the file" />} />
      ) : (
        <section className="panel stack">
          <div className="label">📂 Today&apos;s case</div>
          <p style={{ margin: 0 }}>No new case yet. The next file is still being written. Ask a question below instead.</p>
        </section>
      )}

      {(activeReview || rev.due) && (
        <section className="panel" style={{ marginTop: 20, borderColor: 'var(--accent)', borderWidth: 2, background: 'var(--accent-soft)', ...modeVars('review') }}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="label" style={{ color: 'var(--accent-ink)' }}>📋 Unit review: the Supervisor stopped by</div>
            <p style={{ margin: 0 }}>{activeReview ? 'Your review is still open. The Supervisor is waiting, coffee in hand.' : `You finished every case in ${rev.unit}! Before the next unit, the Supervisor wants to go over it with you.`}</p>
            <div>{activeReview ? <Link className="btn" href={`/case/${activeReview.id}`}>Back to the review</Link> : <StartReview label="Start the unit review" unit={rev.unit} />}</div>
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: 20, borderColor: '#2c7a4b', borderWidth: 2, ...modeVars('inquiry') }}>
        <AskDoor />
      </section>

      {openWonders.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="label" style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 6, marginBottom: 10 }}>✨ Wonder List</div>
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
          <div className="label" style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 6, marginBottom: 10 }}>🗂️ Closed cases</div>
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
