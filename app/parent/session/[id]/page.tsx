import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/sessions';
import MarkTest from '@/app/components/MarkTest';
import { sessionInsights } from '@/lib/insights';

const FUN = { great: '😀 Fun', ok: '😐 OK', meh: '😩 Meh' } as const;
const HARD = { easy: 'Too easy', right: 'Just right', hard: 'Too hard' } as const;

export const dynamic = 'force-dynamic';

export default async function ParentSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) notFound();
  const ins = sessionInsights(s);
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <div className="topbar">
        <Link href="/parent">← Dashboard</Link>
        <span>{s.isTest ? 'Test run' : 'Abi'} · {s.status}</span>
      </div>
      <h1 className="title" style={{ fontSize: 40 }}>{s.caseId === 'inquiry' ? 'Question' : s.caseId === 'review' ? '📋 Review' : `Case ${s.caseId}`}: {s.title}</h1>
      <p className="muted">Started {new Date(s.startedAt).toLocaleString()} · case version {s.caseVersion} · stage {s.stage}</p>
      {!s.isTest && <div style={{ marginBottom: 16 }}><MarkTest sessionId={s.id} /></div>}

      <section className="panel stack" style={{ marginBottom: 20, borderColor: 'var(--teal)', borderWidth: 2 }}>
        <div className="label">📊 How it went</div>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill">⏱️ about {ins.minutes} min{ins.days > 1 ? ` over ${ins.days} days` : ''}</span>
          <span className="pill">💬 {ins.messages} messages from Abi</span>
          <span className="pill">🧑‍🏫 {ins.advisor} advisor clue{ins.advisor === 1 ? '' : 's'}</span>
          {s.mode === 'challenge' && <span className="pill">🧪 {ins.testsFailed} test{ins.testsFailed === 1 ? '' : 's'} failed · {ins.redesigns} redesign{ins.redesigns === 1 ? '' : 's'}</span>}
          {ins.evidence !== undefined && s.mode === 'investigation' && <span className="pill">🔎 {ins.evidence} evidence examined</span>}
          {ins.decisions !== undefined && s.mode === 'simulation' && <span className="pill">🧭 {ins.decisions} decisions</span>}
        </div>
        {ins.longestPause && (
          <p style={{ margin: 0 }}><strong>Longest pause ({ins.longestPause.minutes} min)</strong> came after: <span className="muted">&ldquo;{ins.longestPause.after}&rdquo;</span></p>
        )}
        <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 8 }}>
          <strong>Abi&apos;s feedback:</strong>{' '}
          {s.feedback ? (
            <>
              {s.feedback.fun ? FUN[s.feedback.fun] : '—'} · {s.feedback.difficulty ? HARD[s.feedback.difficulty] : '—'}
              {s.feedback.comment ? <div style={{ marginTop: 4 }}>&ldquo;{s.feedback.comment}&rdquo;</div> : null}
            </>
          ) : (
            <span className="muted">{s.status === 'closed' ? 'none yet' : 'asked when the case closes'}</span>
          )}
        </div>
      </section>

      {s.parent && (
        <section className="panel stack" style={{ marginBottom: 20 }}>
          <div className="label">For you</div>
          <p style={{ margin: 0 }}>{s.parent.whatHappened}</p>
          {s.parent.scaffoldsUsed && <p style={{ margin: 0 }}><strong>Hints given:</strong> {s.parent.scaffoldsUsed}</p>}
          {s.parent.notes && <p style={{ margin: 0 }}><strong>🧑‍🏫 {s.parent.notes}</strong></p>}
          {s.parent.concepts.length > 0 && <p style={{ margin: 0 }}><strong>Concepts:</strong> {s.parent.concepts.join(', ')}</p>}
          {s.summary && <Link href={`/files/${s.id}`}>Abi&apos;s Case Summary</Link>}
        </section>
      )}


      <section className="stack">
        <div className="label">Transcript</div>
        {s.display.map((m, i) => (
          <div key={i} style={{ borderLeft: `4px solid ${m.role === 'abi' ? 'var(--ink)' : 'var(--teal)'}`, paddingLeft: 10 }}>
            <div className="label" style={{ fontSize: 10 }}>{m.role === 'abi' ? 'Abi' : 'Guide'} · {new Date(m.at).toLocaleTimeString()}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.image ? `[Exhibit shown: ${m.image.alt}]` : m.text}</div>
          </div>
        ))}
      </section>

      <details style={{ marginTop: 28, fontSize: 14 }}>
        <summary className="muted" style={{ cursor: 'pointer' }}>🔧 Technical details (for troubleshooting)</summary>
        <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', fontFamily: 'var(--mono)' }}>{JSON.stringify(s.state, null, 2)}</pre>
      </details>
    </main>
  );
}
