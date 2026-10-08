import Link from 'next/link';
import { listSessions } from '@/lib/sessions';

export const dynamic = 'force-dynamic';

export default async function Archive() {
  const closed = (await listSessions()).filter((s) => s.status === 'closed' && !s.isTest).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return (
    <main className="wrap">
      <div className="topbar">
        <Link href="/">← Case Files</Link>
        <span>Archive</span>
      </div>
      <h1 className="title" style={{ fontSize: 52 }}>Closed Cases</h1>
      {closed.length === 0 ? (
        <p className="muted">Nothing closed yet. Every case you solve lands here.</p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {closed.map((s) => (
            <Link key={s.id} href={`/files/${s.id}`} className="panel" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
              <div className="label">{s.caseId === 'inquiry' ? 'Open Question' : `Case ${s.caseId}`} · {new Date(s.updatedAt).toLocaleDateString()}</div>
              <div style={{ fontWeight: 600, fontSize: 20 }}>{s.title}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
