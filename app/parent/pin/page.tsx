'use client';
import { useState } from 'react';

export default function ParentPin() {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/parent/pin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
    if (r.ok) window.location.href = '/parent';
    else setErr('Wrong PIN.');
  }
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="label">Parent dashboard</div>
      <form onSubmit={go} className="stack" style={{ marginTop: 16 }}>
        <label htmlFor="pin">Parent PIN</label>
        <input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        <button className="btn" type="submit">Enter</button>
        {err && <p role="alert" style={{ color: 'var(--rust)', margin: 0 }}>{err}</p>}
      </form>
    </main>
  );
}
