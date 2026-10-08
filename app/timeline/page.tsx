import Link from 'next/link';
import { listTimeline, yearKey } from '@/lib/sessions';

export const dynamic = 'force-dynamic';

export default async function Timeline() {
  const items = (await listTimeline()).sort((a, b) => yearKey(a.year) - yearKey(b.year));
  return (
    <main className="wrap">
      <div className="topbar">
        <Link href="/">← Case Files</Link>
        <span>Timeline</span>
      </div>
      <h1 className="title" style={{ fontSize: 52 }}>My Timeline</h1>
      {items.length === 0 ? (
        <p className="muted">Empty for now. Real events get pinned here as they come up in your cases.</p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderLeft: '3px solid var(--ink)' }}>
          {items.map((t, i) => (
            <li key={i} style={{ position: 'relative', padding: '0 0 22px 22px' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: -9, top: 6, width: 15, height: 15, borderRadius: '50%', background: 'var(--teal)', border: '3px solid var(--paper)' }} />
              <div className="label" style={{ color: 'var(--teal)' }}>{t.year}</div>
              <div style={{ fontWeight: 600 }}>{t.label}</div>
              <div className="muted" style={{ fontSize: 14 }}>from {t.caseId === 'inquiry' ? 'a question' : `Case ${t.caseId}`}: {t.caseTitle}</div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
