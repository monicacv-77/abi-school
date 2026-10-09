import Link from 'next/link';
import { CASES, getCase } from '@/lib/cases';
import { getUnit } from '@/lib/units';
import { listSessions, listTimeline, listWonders, nextCase, reviewStatus } from '@/lib/sessions';
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


const RANKS = [
  { at: 0, name: 'Rookie Investigator', badge: '🐣' },
  { at: 3, name: 'Junior Investigator', badge: '🔍' },
  { at: 10, name: 'Investigator', badge: '🔎' },
  { at: 20, name: 'Field Agent', badge: '🕵️' },
  { at: 35, name: 'Senior Investigator', badge: '🎖️' },
  { at: 50, name: 'Lead Investigator', badge: '🧭' },
  { at: 70, name: 'Chief Investigator', badge: '🏅' },
  { at: 100, name: 'Legend of the Case Files', badge: '🏆' },
]
const QUIPS = [
  "Today's forecast: 90% chance of evidence.",
  'The coffee is cold. The case files are hot.',
  "Rule #1: always ask who's telling the story.",
  'No case too weird. Some cases very weird.',
  'Every mystery is just a question that hasn\'t met you yet.',
  'Investigating is hungry work. Snacks are allowed.',
  'History called. It left a lot of clues.',
  'Trust the evidence. Question the ads.',
];

function rankFor(n: number) {
  let r = RANKS[0];
  for (const x of RANKS) if (n >= x.at) r = x;
  const next = RANKS.find((x) => x.at > n);
  return { ...r, next, toGo: next ? next.at - n : 0 };
}

export default async function Home() {
  const [{ active, next }, sessions, wonders, rev, timeline] = await Promise.all([nextCase(), listSessions(), listWonders(), reviewStatus(), listTimeline()]);
  const activeReview = sessions.filter((s) => s.caseId === 'review' && s.status === 'active' && !s.isTest).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const closed = sessions.filter((s) => s.status === 'closed' && !s.isTest && s.caseId !== 'review').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeCase = active ? getCase(active.caseId) : undefined;
  const openWonders = wonders.filter((w) => w.status === 'open');
  const casesClosed = closed.filter((s) => s.caseId !== 'inquiry');
  const questionsDone = closed.filter((s) => s.caseId === 'inquiry').length;
  const rank = rankFor(closed.length); // cases and open questions both count
  const quip = QUIPS[Math.floor(Date.now() / 86400000) % QUIPS.length];
  // Case board: the unit Abi is working on now.
  const boardUnit = (activeCase ?? next ?? getCase(casesClosed[0]?.caseId ?? ''))?.unit ?? CASES[0]?.unit;
  const unitDef = getUnit(boardUnit);
  const boardCases = CASES.filter((c) => c.unit === boardUnit && c.status === 'READY').sort((a, b) => a.id.localeCompare(b.id));
  const reviewDone = sessions.some((s) => s.caseId === 'review' && s.status === 'closed' && !s.isTest && s.title === `Unit review: ${boardUnit}`);

  return (
    <main className="wrap">
      <div className="topbar">
        <span>Abi&apos;s Case Files</span>
        <span className="row" style={{ gap: 16 }}>
          <Link href="/timeline">🕰️ Timeline</Link>
          <Link href="/files">🗂️ Archive</Link>
        </span>
      </div>

      <section className="hq">
        <div className="hq-badge" aria-hidden="true">{rank.badge}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hq-hello">Hey, Agent Abi</div>
          <div className="hq-rank">{rank.name}{rank.next ? <span className="muted"> · {rank.toGo} more to {rank.next.name}</span> : null}</div>
          <div className="hq-quip">{quip}</div>
        </div>
      </section>
      <div className="hq-stats">
        <span>🗂️ <strong>{casesClosed.length}</strong> {casesClosed.length === 1 ? 'case' : 'cases'} closed</span>
        <span>💡 <strong>{questionsDone}</strong> {questionsDone === 1 ? 'question' : 'questions'} explored</span>
        <span>🕰️ <strong>{timeline.length}</strong> timeline {timeline.length === 1 ? 'pin' : 'pins'}</span>
        <span>✨ <strong>{openWonders.length}</strong> {openWonders.length === 1 ? 'wonder' : 'wonders'} saved</span>
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

      {boardCases.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div className="label" style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 6, marginBottom: 10 }}>📌 Case board · {unitDef?.title ?? boardUnit}</div>
          <div className="board">
            {boardCases.map((c) => {
              const done = closed.find((s) => s.caseId === c.id);
              const isNow = active?.caseId === c.id || (!active && next?.id === c.id);
              const look = lookFor(c.mode);
              const tile = (
                <div className={`tile${done ? ' done' : isNow ? ' now' : ' locked'}`} style={modeVars(c.mode)}>
                  <div className="tile-ic" aria-hidden="true">{done || isNow ? look.emoji : '🔒'}</div>
                  <div className="tile-num">Case {c.id}</div>
                  <div className="tile-title">{c.title}</div>
                  {done && <div className="tile-stamp">CLOSED</div>}
                  {isNow && !done && <div className="tile-now">{active?.caseId === c.id ? 'In progress' : 'Up next'}</div>}
                </div>
              );
              return done ? <Link key={c.id} href={`/files/${done.id}`} className="tile-link">{tile}</Link> : <div key={c.id}>{tile}</div>;
            })}
            <div className={`tile ${reviewDone ? 'done' : rev.due ? 'now' : 'locked'}`} style={modeVars('review')}>
              <div className="tile-ic" aria-hidden="true">{reviewDone || rev.due ? '📋' : '🔒'}</div>
              <div className="tile-num">Finale</div>
              <div className="tile-title">Unit review</div>
              {reviewDone && <div className="tile-stamp">DONE</div>}
            </div>
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
