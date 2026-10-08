'use client';
import { useState } from 'react';

export default function MarkTest({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn ghost"
      disabled={busy}
      style={{ minHeight: 40, padding: '6px 14px', fontSize: 15 }}
      onClick={async () => {
        if (!confirm("Move this session to test runs? It won't count as Abi's progress.")) return;
        setBusy(true);
        const r = await fetch('/api/parent/mark-test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) });
        if (r.ok) window.location.href = '/parent';
        else setBusy(false);
      }}
    >
      Move to test runs
    </button>
  );
}
