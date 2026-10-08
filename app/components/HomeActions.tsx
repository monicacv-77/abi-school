'use client';
import { useState } from 'react';

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export function StartCase({ caseId, label, test = false }: { caseId: string; label: string; test?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await post('/api/session', { caseId, test });
          window.location.href = `/case/${id}`;
        } catch (e) {
          alert((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy ? 'Opening…' : label}
    </button>
  );
}

export function AskDoor() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<'' | 'ask' | 'save'>('');
  const [saved, setSaved] = useState(false);
  async function ask() {
    if (!q.trim()) return;
    setBusy('ask');
    try {
      const { id } = await post('/api/session', { question: q });
      window.location.href = `/case/${id}`;
    } catch (e) {
      alert((e as Error).message);
      setBusy('');
    }
  }
  async function save() {
    if (!q.trim()) return;
    setBusy('save');
    try {
      await post('/api/wonder', { question: q });
      setQ('');
      setSaved(true);
      setTimeout(() => window.location.reload(), 600);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="stack">
      <label htmlFor="ask" className="label">Wondering about something?</label>
      <textarea id="ask" rows={2} value={q} onChange={(e) => { setQ(e.target.value); setSaved(false); }} placeholder="Ask anything…" />
      <div className="row">
        <button className="btn" onClick={ask} disabled={!q.trim() || Boolean(busy)}>{busy === 'ask' ? 'Thinking…' : 'Explore it now'}</button>
        <button className="btn ghost" onClick={save} disabled={!q.trim() || Boolean(busy)}>Save for later</button>
        {saved && <span className="muted">Saved.</span>}
      </div>
    </div>
  );
}

export function ExploreWonder({ id, question }: { id: string; question: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn ghost"
      style={{ minHeight: 40, padding: '6px 12px', fontSize: 15 }}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id: sid } = await post('/api/session', { question, wonderId: id });
          window.location.href = `/case/${sid}`;
        } catch (e) {
          alert((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy ? 'Thinking…' : 'Explore'}
    </button>
  );
}
