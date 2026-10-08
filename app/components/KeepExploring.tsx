'use client';
import { useState } from 'react';

// End-of-case follow-up questions: explore now (starts an Inquiry) or save to the Wonder List.
export default function KeepExploring({ questions }: { questions: string[] }) {
  const [busy, setBusy] = useState<string>('');
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  return (
    <div className="panel stack" style={{ borderColor: 'var(--teal)', borderWidth: 2 }}>
      <div className="label" style={{ color: 'var(--teal)' }}>Keep exploring</div>
      {questions.map((q) => (
        <div key={q} style={{ borderTop: '1px solid var(--rule)', paddingTop: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{q}</div>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn"
              style={{ minHeight: 44, padding: '6px 14px', fontSize: 15 }}
              disabled={Boolean(busy)}
              onClick={async () => {
                setBusy(q);
                try {
                  const { id } = await post('/api/session', { question: q });
                  window.location.href = `/case/${id}`;
                } catch (e) {
                  alert((e as Error).message);
                  setBusy('');
                }
              }}
            >
              {busy === q ? 'Thinking…' : 'Explore now'}
            </button>
            <button
              className="btn ghost"
              style={{ minHeight: 44, padding: '6px 14px', fontSize: 15 }}
              disabled={Boolean(busy) || saved[q]}
              onClick={async () => {
                try {
                  await post('/api/wonder', { question: q });
                  setSaved((s) => ({ ...s, [q]: true }));
                } catch (e) {
                  alert((e as Error).message);
                }
              }}
            >
              {saved[q] ? 'Saved ✓' : 'Save for later'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
