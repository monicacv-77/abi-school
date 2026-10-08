'use client';
import { useState } from 'react';

export default function Login() {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode: code }) });
    if (r.ok) window.location.href = '/';
    else setErr('Nope. Try again.');
  }
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="label">Abi&apos;s Case Files</div>
      <h1 className="title" style={{ fontSize: 56 }}>Restricted Archive</h1>
      <form onSubmit={go} className="stack">
        <label htmlFor="code">Passcode</label>
        <input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        <button className="btn" type="submit">Open</button>
        {err && <p role="alert" style={{ color: 'var(--rust)', margin: 0 }}>{err}</p>}
      </form>
    </main>
  );
}
