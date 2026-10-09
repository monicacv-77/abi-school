import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/sessions';
import MarkTest from '@/app/components/MarkTest';

export const dynamic = 'force-dynamic';

export default async function ParentSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) notFound();
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <div className="topbar">
        <Link href="/parent">← Dashboard</Link>
        <span>{s.isTest ? 'Test run' : 'Abi'} · {s.status}</span>
      </div>
      <h1 className="title" style={{ fontSize: 40 }}>{s.caseId === 'inquiry' ? 'Question' : s.caseId === 'review' ? '📋 Review' : `Case ${s.caseId}`}: {s.title}</h1>
      <p className="muted">Started {new Date(s.startedAt).toLocaleString()} · case version {s.caseVersion} · stage {s.stage}</p>
      {!s.isTest && <div style={{ marginBottom: 16 }}><MarkTest sessionId={s.id} /></div>}

      {s.parent && (
        <section className="panel stack" style={{ marginBottom: 20 }}>
          <div className="label">For you</div>
          <p style={{ margin: 0 }}>{s.parent.whatHappened}</p>
          {s.parent.scaffoldsUsed && <p style={{ margin: 0 }}><strong>Hints given:</strong> {s.parent.scaffoldsUsed}</p>}
          {s.parent.concepts.length > 0 && <p style={{ margin: 0 }}><strong>Concepts:</strong> {s.parent.concepts.join(', ')}</p>}
          {s.summary && <Link href={`/files/${s.id}`}>Abi&apos;s Case Summary</Link>}
        </section>
      )}

      <section className="panel" style={{ marginBottom: 20, fontSize: 14 }}>
        <div className="label">Game state</div>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'var(--mono)' }}>{JSON.stringify(s.state, null, 2)}</pre>
      </section>

      <section className="stack">
        <div className="label">Transcript</div>
        {s.display.map((m, i) => (
          <div key={i} style={{ borderLeft: `4px solid ${m.role === 'abi' ? 'var(--ink)' : 'var(--teal)'}`, paddingLeft: 10 }}>
            <div className="label" style={{ fontSize: 10 }}>{m.role === 'abi' ? 'Abi' : 'Guide'} · {new Date(m.at).toLocaleTimeString()}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.image ? `[Exhibit shown: ${m.image.alt}]` : m.text}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
