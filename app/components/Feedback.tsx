'use client';
import { useState } from 'react';
import type { SessionView } from '@/lib/view';

type FB = NonNullable<SessionView['feedback']>;

// "How was that?" at the end of a case: two quick taps and an optional note.
export default function Feedback({ sessionId, initial }: { sessionId: string; initial?: FB }) {
  const [fb, setFb] = useState<Partial<FB>>(initial ?? {});
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [sent, setSent] = useState(Boolean(initial?.comment));
  async function save(patch: Partial<FB>) {
    const next = { ...fb, ...patch };
    setFb(next);
    await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, ...next }) }).catch(() => {});
  }
  const pick = (on: boolean) => (on ? 'fb-btn on' : 'fb-btn');
  return (
    <section className="panel stack fb" aria-label="How was that?">
      <div className="side-h" style={{ marginBottom: 0 }}>💬 How was that?</div>
      <div className="row" style={{ gap: 8 }}>
        <span className="fb-q">Fun?</span>
        <button className={pick(fb.fun === 'great')} onClick={() => save({ fun: 'great' })}>😀 Fun</button>
        <button className={pick(fb.fun === 'ok')} onClick={() => save({ fun: 'ok' })}>😐 OK</button>
        <button className={pick(fb.fun === 'meh')} onClick={() => save({ fun: 'meh' })}>😩 Meh</button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span className="fb-q">Hard?</span>
        <button className={pick(fb.difficulty === 'easy')} onClick={() => save({ difficulty: 'easy' })}>Too easy</button>
        <button className={pick(fb.difficulty === 'right')} onClick={() => save({ difficulty: 'right' })}>Just right</button>
        <button className={pick(fb.difficulty === 'hard')} onClick={() => save({ difficulty: 'hard' })}>Too hard</button>
      </div>
      {sent ? (
        <div className="muted">✅ Thanks! That helps make the cases better.</div>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          <label htmlFor="fb-note" className="fb-q">Anything you&apos;d change or make better? (optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea id="fb-note" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Too long? Boring part? Something cool to add?" style={{ flex: 1 }} />
            <button className="btn" disabled={!comment.trim()} onClick={async () => { await save({ comment }); setSent(true); }}>Send</button>
          </div>
        </div>
      )}
    </section>
  );
}
