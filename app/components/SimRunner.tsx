'use client';
import { useState } from 'react';

export default function SimRunner({ cases }: { cases: { id: string; title: string }[] }) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? '');
  const [persona, setPersona] = useState('rusher');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<null | { status: string; guideWordsAvg: number; guideWordsMax: number; transcript: string[]; sessionId: string }>(null);
  const [err, setErr] = useState('');
  async function run() {
    setBusy(true);
    setErr('');
    setOut(null);
    try {
      const r = await fetch('/api/parent/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId, persona, turns: 10 }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      setOut(data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="row">
        <label>
          Case{' '}
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} style={{ font: 'inherit', padding: 8 }}>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.id} {c.title}</option>)}
          </select>
        </label>
        <label>
          Student{' '}
          <select value={persona} onChange={(e) => setPersona(e.target.value)} style={{ font: 'inherit', padding: 8 }}>
            <option value="rusher">Rusher</option>
            <option value="curious">Curious</option>
            <option value="unusual">Unusual ideas</option>
            <option value="stuck">Gets stuck</option>
          </select>
        </label>
        <button className="btn" onClick={run} disabled={busy}>{busy ? 'Running (1–3 min)…' : 'Run test'}</button>
      </div>
      {err && <p role="alert" style={{ color: 'var(--rust)' }}>{err}</p>}
      {out && (
        <div className="panel stack" style={{ fontSize: 15 }}>
          <div className="label">Result: {out.status} · guide avg {out.guideWordsAvg} words · max {out.guideWordsMax}</div>
          {out.transcript.map((l, i) => <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{l}</div>)}
          <a href={`/parent/session/${out.sessionId}`}>Open full record</a>
        </div>
      )}
    </div>
  );
}
