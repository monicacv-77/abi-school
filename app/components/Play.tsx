'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SessionView } from '@/lib/view';
import KeepExploring from './KeepExploring';
import { lookFor, modeVars } from '@/lib/look';

const THINKING = ['Thinking…', 'Checking the evidence…', 'Consulting the archive…', 'Doing the math…', 'Hmm…'];


const SpeakerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
  </svg>
);

function plain(text: string) {
  return text.replace(/\*\*/g, '').replace(/[#_`>]/g, '');
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : <span key={j}>{part}</span>,
      )}
    </>
  );
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => {
        const lines = para.split('\n');
        const isStatus = (/your colony|what changed|test results|review report/i.test(lines[0].replace(/\*/g, '')) || /test \d+ of \d+/i.test(lines[0])) && lines.length > 1;
        const q = para.replace(/\*/g, '').match(/^\s*Question\s+(\d+)\s+of\s+(\d+)\s*[:.]\s*([\s\S]+)$/i);
        const yw = para.replace(/\*/g, '').match(/^\s*✍️\s*In your words\s*[:.]\s*([\s\S]+)$/i);
        if (yw)
          return (
            <div key={i} className="question-card">
              <div className="q-num">✍️ In your words</div>
              <div className="q-text">{yw[1].trim()}</div>
            </div>
          );
        if (q)
          return (
            <div key={i} className="question-card">
              <div className="q-num">❓ Question {q[1]} of {q[2]}</div>
              <div className="q-text">{q[3].trim()}</div>
            </div>
          );
        if (isStatus)
          return (
            <div key={i} className="status-card">
              <div className="label">{lines[0].replace(/\*/g, '')}</div>
              {lines.slice(1).map((l, k) => (
                <div key={k}><Inline text={l} /></div>
              ))}
            </div>
          );
        return (
          <p key={i} style={{ margin: i ? '10px 0 0' : 0 }}>
            {lines.map((l, k) => (
              <span key={k}>
                {k ? <br /> : null}
                <Inline text={l} />
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

const ARROW = { up: '↑', down: '↓', same: '→' } as const;
const ARROW_WORD = { up: 'up', down: 'down', same: 'no change' } as const;
function Arrow({ dir, amount }: { dir?: 'up' | 'down' | 'same'; amount?: number }) {
  if (!dir) return <span className="arrow" />;
  return (
    <span className={`arrow ${dir}`} aria-label={ARROW_WORD[dir]} title={ARROW_WORD[dir]}>
      {ARROW[dir]}{amount && dir !== 'same' ? Math.abs(amount) : ''}
    </span>
  );
}

function ColonyPanel({ v }: { v: SessionView }) {
  const split = (label: string) => {
    const m = label.match(/^(\P{L}+)\s*(.*)$/u);
    return m ? { icon: m[1].trim(), name: m[2] } : { icon: '', name: label };
  };
  return (
    <section className="budget colony" aria-label="Your colony">
      <div className="side-h">🧭 Your Colony</div>
      {v.lastChoice ? <div className="muted" style={{ fontSize: 14, marginTop: -4, marginBottom: 6 }}>Arrows show the last turn: <strong>{v.lastChoice}</strong></div> : null}
      <div className="colony-rows">
        {v.stats!.map((st) => {
          const { icon, name } = split(st.label);
          const low = !st.count && st.value <= 3;
          return (
            <div key={st.label} className="colony-row">
              <span className="c-ic" aria-hidden="true">{icon}</span>
              <span className="c-name">{name}</span>
              <span className="c-val" style={{ color: low ? 'var(--rust)' : undefined }}>{st.count ? st.value : st.word}</span>
              <Arrow dir={st.dir} amount={st.count ? st.delta : undefined} />
            </div>
          );
        })}
        {v.story && v.story.length > 0 && <div className="colony-sep">From the story</div>}
        {v.story?.map((st) => {
          const { icon, name } = split(st.label);
          return (
            <div key={st.label} className="colony-row">
              <span className="c-ic" aria-hidden="true">{icon}</span>
              <span className="c-name">{name}</span>
              <span className="c-val">{st.value}</span>
              <Arrow dir={st.dir} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

type BudgetBox = NonNullable<SessionView['budgetBox']>;

function BudgetPanel({ b }: { b: BudgetBox }) {
  const n = (x: number) => x.toLocaleString('en-US');
  const money = (x: number) => (b.unit ? n(x) : `$${n(x)}`);
  const left = b.budget - b.spent;
  const over = left < 0;
  const pct = Math.min(100, Math.round((b.spent / b.budget) * 100));
  const unitWord = b.unit ?? 'dollars';
  return (
    <section className="budget" aria-label="Budget">
      <div className="side-h">💰 Budget</div>
      <div className="budget-left" style={{ color: over ? 'var(--rust)' : 'var(--accent-ink)' }}>
        <span className="big">{money(Math.abs(left))}</span>
        <span>{b.unit ? `${unitWord} ` : ''}{over ? 'over budget!' : 'left'}</span>
      </div>
      <div className="meter" aria-hidden="true"><span style={{ width: `${pct}%`, background: over ? 'var(--rust)' : 'var(--accent)' }} /></div>
      <div className="muted" style={{ fontSize: 15 }}>{money(b.spent)} of {money(b.budget)} {b.unit ? unitWord : ''} used</div>
      {b.needs && b.needs.length > 0 && (
        <>
          <div className="colony-sep">✅ What your settlement needs</div>
          <ul className="needs">
            {b.needs.map((n) => (
              <li key={n.label} className={n.ok ? 'ok' : ''}>
                <span className="need-mark" aria-label={n.ok ? 'covered' : 'not yet'}>{n.ok ? '✔' : '○'}</span>
                <span aria-hidden="true">{n.icon}</span> {n.label}
              </li>
            ))}
          </ul>
        </>
      )}

      {b.items.length ? (
        <table className="budget-table">
          <thead>
            <tr><th scope="col">Item</th><th scope="col" className="num">{b.unit ?? 'Cost'}</th></tr>
          </thead>
          <tbody>
            {b.items.map((it, i) => (
              <tr key={i}>
                <td><span className="qty">{it.qty}×</span> {it.name}</td>
                <td className="num">{money(it.cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td className="num">{money(b.spent)}</td></tr>
          </tfoot>
        </table>
      ) : (
        <div className="muted" style={{ fontSize: 15, marginTop: 10 }}>Nothing picked yet. Ask what things cost.</div>
      )}

      {b.scarce && (
        <div className="budget-row" style={{ color: b.scarce.used > b.scarce.limit ? 'var(--rust)' : undefined }}>
          <span>🔩 {b.scarce.label[0].toUpperCase() + b.scarce.label.slice(1)}</span>
          <strong>{b.scarce.used} of {b.scarce.limit}</strong>
        </div>
      )}
      {b.capacity && (
        <div className="budget-row" style={{ color: b.capacity.target && b.capacity.value < b.capacity.target ? 'var(--rust)' : undefined }}>
          <span>📐 Design {b.unit ? 'holds' : 'makes'}</span>
          <strong>{n(b.capacity.value)}{b.capacity.target ? ` of ${n(b.capacity.target)}` : ''}</strong>
        </div>
      )}
      {b.capacity && <div className="muted" style={{ fontSize: 14, textAlign: 'right' }}>{b.capacity.label}</div>}
      {b.days ? (
        <div className="budget-row"><span>⏱️ Build time</span><strong>~{b.days} days</strong></div>
      ) : null}
      {b.designed && <div className="budget-status" data-ok={b.ready ? '1' : '0'}>{b.ready ? '✅ Design ready to test' : '🚧 Design not done yet'}</div>}
    </section>
  );
}

type Recog = { start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; interimResults: boolean; lang: string };

export default function Play({ initial }: { initial: SessionView }) {
  const [view, setView] = useState(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [showToolbox, setShowToolbox] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinkIdx, setThinkIdx] = useState(0);
  const [canTalk, setCanTalk] = useState(false);
  const recog = useRef<Recog | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const W = window as any;
    setCanTalk(Boolean(W.SpeechRecognition || W.webkitSpeechRecognition));
    try { setAutoRead(localStorage.getItem('abi-autoread') === '1'); } catch {}
  }, []);
  const seen = useRef(initial.display.length);
  useEffect(() => {
    const prev = seen.current;
    seen.current = view.display.length;
    if (view.display.length <= prev) return;
    // A new reply: show it from its first line, not its last.
    let first = -1;
    for (let i = prev; i < view.display.length; i++) if (view.display[i].role !== 'abi' || view.display[i].image) { first = i; break; }
    if (first >= 0) {
      document.querySelector(`[data-msg="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      bottom.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view.display]);
  useEffect(() => {
    // Coming back to a case: start at the top of the last reply.
    const d = initial.display;
    let last = -1;
    for (let i = d.length - 1; i >= 0; i--) if (d[i].role === 'guide') { last = i; break; }
    if (last > 0) document.querySelector(`[data-msg="${last}"]`)?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (busy) bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [busy]);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setThinkIdx((i) => (i + 1) % THINKING.length), 2200);
    return () => clearInterval(t);
  }, [busy]);

  function speak(t: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plain(t));
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }

  function toggleListen() {
    const W = window as any;
    const R = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!R) return;
    if (listening) { recog.current?.stop(); return; }
    const r: Recog = new R();
    r.lang = 'en-US';
    r.interimResults = true;
    const before = text ? text + ' ' : '';
    r.onresult = (e: any) => {
      let said = '';
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      setText(before + said);
    };
    r.onend = () => setListening(false);
    recog.current = r;
    window.speechSynthesis?.cancel();
    r.start();
    setListening(true);
  }

  async function send(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const t = (override ?? text).trim();
    if (!t || busy) return;
    recog.current?.stop();
    setBusy(true);
    setErr('');
    setText('');
    setView((v) => ({ ...v, display: [...v.display, { role: 'abi', text: t, at: new Date().toISOString() }] }));
    try {
      const r = await fetch('/api/turn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: view.id, text: t }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Something went wrong');
      setView(data.view);
      const last = data.view.display[data.view.display.length - 1];
      if (autoRead && last?.role === 'guide') speak(last.text);
    } catch (ex) {
      setErr((ex as Error).message);
      if (!override) setText(t);
      setView((v) => ({ ...v, display: v.display.slice(0, -1) }));
    } finally {
      setBusy(false);
    }
  }

  const closed = view.status === 'closed';
  const twoCol = (view.mode === 'challenge' && Boolean(view.budgetBox)) || (view.mode === 'simulation' && Boolean(view.stats)) || (view.mode === 'investigation' && Boolean(view.opening)) || view.mode === 'inquiry' || view.mode === 'review';

  const heroEl = view.image && (
    <figure className={`hero${view.image.fit === 'contain' ? ' contain' : ''}`}>
      <img src={view.image.src} alt={view.image.alt} loading="lazy" style={view.image.position ? { objectPosition: view.image.position } : undefined} />
      <figcaption>
        <a href={view.image.href} target="_blank" rel="noreferrer">{view.image.credit}</a>
      </figcaption>
    </figure>
  );

  const introEl = view.opening && (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, fontSize: 21, lineHeight: 1.5 }}>
          {view.opening.intro.split(/\n{2,}/).map((para, i) => (
            <p key={i} style={{ margin: i ? '12px 0 0' : 0 }}>{para}</p>
          ))}
        </div>
        <button aria-label="Read the opening aloud" onClick={() => speak(view.opening!.intro)} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', minHeight: 44, minWidth: 44 }}><SpeakerIcon /></button>
      </div>
      {view.opening.video && (
        <details className="panel" style={{ padding: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 32 }}>Watch first: {view.opening.video.title} ({view.opening.video.minutes} min)</summary>
          <div style={{ position: 'relative', paddingTop: '56.25%', marginTop: 10, background: '#000', borderRadius: 6, overflow: 'hidden' }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${view.opening.video.youtubeId}?rel=0`}
              title={view.opening.video.title}
              loading="lazy"
              allow="encrypted-media; picture-in-picture; fullscreen"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Video: {view.opening.video.source}</div>
        </details>
      )}
    </>
  );

  const sideEl = twoCol && (
    <aside className="play-side no-print" aria-label="Briefs and status">
      {view.budgetBox && <BudgetPanel b={view.budgetBox} />}
      {view.mode === 'simulation' && view.stats && <ColonyPanel v={view} />}
      {view.mode === 'investigation' && (
        <section className="budget" aria-label="Theory board">
          <div className="side-h">📌 Theory board</div>
          {view.board && view.board.length > 0 ? (
            <div className="stack" style={{ gap: 12 }}>
              {view.board.map((b) => (
                <div key={b.theory} style={{ borderLeft: '4px solid var(--accent)', paddingLeft: 10 }}>
                  <div style={{ fontWeight: 700 }}>{b.theory}</div>
                  {b.supporting.length > 0 && <div style={{ fontSize: 15 }}><span style={{ color: '#1f6b3a', fontWeight: 700 }}>✔ Backs it up:</span> {b.supporting.join(' · ')}</div>}
                  {b.problems.length > 0 && <div style={{ fontSize: 15 }}><span style={{ color: 'var(--rust)', fontWeight: 700 }}>✘ Doesn&apos;t fit:</span> {b.problems.join(' · ')}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 15 }}>No theories yet. When you have one, say it and it gets pinned here.</div>
          )}
          {view.evidence && view.evidence.length > 0 && (
            <>
              <div className="colony-sep">🔎 Evidence you&apos;ve found ({view.evidence.length})</div>
              <ul className="choice-log" style={{ paddingLeft: 20, marginTop: 6 }}>
                {view.evidence.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </>
          )}
        </section>
      )}
      {view.review && (
        <section className="budget" aria-label="Review">
          <div className="side-h">📋 Supervisor&apos;s review</div>
          <div className="muted" style={{ fontSize: 14, marginTop: -4, marginBottom: 8 }}>Big ideas from {view.review.unitTitle ?? 'this unit'}, across these cases:</div>
          <ul className="choice-log" style={{ paddingLeft: 20 }}>
            {view.review.cases.map((c) => <li key={c.caseId + c.title}>{c.caseId === 'inquiry' ? 'Question' : `Case ${c.caseId}`}: {c.title}</li>)}
          </ul>
          <div className="colony-sep">Questions</div>
          <div className="row" style={{ gap: 8, marginTop: 8 }} aria-label={`${view.review.answers.length} of ${view.review.total} answered`}>
            {Array.from({ length: view.review.total }, (_, i) => {
              const a = view.review!.answers[i];
              const mark = !a ? '' : a.result === 'got_it' ? '✅' : a.result === 'partly' ? '🟡' : '❌';
              return <span key={i} className="review-dot" title={a ? a.result : 'not yet'}>{mark || i + 1}</span>;
            })}
          </div>
        </section>
      )}
      {view.mode === 'inquiry' && (
        <section className="budget" aria-label="Key points">
          <div className="side-h">💡 Key points</div>
          {view.startingIdea && (
            <div className="key-start"><span className="label">🌱 What you thought at first</span><div>{view.startingIdea}</div></div>
          )}
          {view.keyPoints && view.keyPoints.length > 0 ? (
            <ol className="key-points">
              {view.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
            </ol>
          ) : (
            <div className="muted" style={{ fontSize: 15 }}>The big ideas you figure out will collect here.</div>
          )}
        </section>
      )}
      {view.opening && (
      <section>
        <div className="side-h">📋 Briefs</div>
        {(() => {
          const card = (c: NonNullable<SessionView['opening']>['cards'][number], i: number) => (
            <details key={`${c.label}-${i}`} className="brief">
              <summary>
                {c.icon && <span className="ic" aria-hidden="true">{c.icon}</span>}
                <span style={{ flex: 1 }}>{c.label}</span>
              </summary>
              <div className="brief-body">
                <span style={{ flex: 1 }}>{c.text}</span>
                <button aria-label={`Read ${c.label} aloud`} onClick={() => speak(`${c.label}. ${c.text}`)} className="icon-btn"><SpeakerIcon /></button>
              </div>
            </details>
          );
          const cards = view.opening!.cards;
          const briefs = cards.filter((c) => c.kind === 'brief');
          const places = cards.filter((c) => c.kind === 'place');
          const voices = cards.filter((c) => !c.kind || c.kind === 'voice');
          return (
            <div className="stack" style={{ gap: 6 }}>
              {briefs.map(card)}
              {view.blocks && (
                <details className="brief">
                  <summary>
                    <span className="ic" aria-hidden="true">🧰</span>
                    <span style={{ flex: 1 }}>Toolbox</span>
                  </summary>
                  <div className="brief-body" style={{ display: 'block' }}>
                    {view.blocks.map((b) => (
                      <div key={b.name} style={{ marginBottom: 6 }}><strong>{b.name}:</strong> <span className="muted">{b.examples}</span></div>
                    ))}
                    <div className="muted" style={{ fontSize: 15 }}>Ask for any cost or spec. Got another idea? Propose it.</div>
                  </div>
                </details>
              )}
              {places.map(card)}
              {voices.length > 0 && <div className="brief-group">🗣️ Reports</div>}
              {voices.map(card)}
            </div>
          );
        })()}
      </section>
      )}
      {view.choices && view.choices.length > 0 && (
        <section>
          <div className="side-h">📜 Your choices</div>
          <ol className="choice-log">
            {view.choices.map((ch) => <li key={ch.n}>{ch.label}</li>)}
          </ol>
        </section>
      )}
    </aside>
  );

  return (
    <main className={`wrap${twoCol ? ' wide' : ''}`} style={{ paddingBottom: 200, ...modeVars(view.mode) }}>
      <div className="topbar no-print">
        <Link href="/">← Case Files</Link>
        <span>{view.caseId === 'inquiry' ? 'Question' : view.caseId === 'review' ? 'Review' : `Case ${view.number}`}</span>
      </div>

      <header style={{ marginBottom: 16 }}>
        <span className="tag mode"><span aria-hidden="true">{lookFor(view.mode).emoji}</span> {lookFor(view.mode).name}</span>
        <span className="tag">{view.classification}</span>
        <h1 className="title" style={{ fontSize: 40 }}>{view.mode === 'inquiry' ? view.question : view.mode === 'review' ? (view.review?.unitTitle ? `Unit Review: ${view.review.unitTitle.replace(/^Unit \d+: /, '')}` : 'The Supervisor Stopped By') : view.title}</h1>
      </header>

      <div className={twoCol ? 'play-grid' : undefined}>
      {sideEl}
      <div className="play-main">
      {heroEl}

      {view.opening && (
        <section className="stack" style={{ gap: 10, marginBottom: 18 }}>
          {introEl}
          {!twoCol && (
            <>
          <div className="row" style={{ gap: 8 }}>
            {view.opening.cards.map((c, i) => (
              <button key={i} className="card-btn" aria-expanded={Boolean(open[i])} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
                {c.icon && <span className="ic" aria-hidden="true">{c.icon}</span>}
                {c.label}
              </button>
            ))}
            {view.blocks && (
              <button className="card-btn" aria-expanded={showToolbox} onClick={() => setShowToolbox((s) => !s)} style={{ borderColor: 'var(--ink)', background: showToolbox ? 'var(--ink)' : 'var(--card)', color: showToolbox ? 'var(--paper)' : 'var(--ink)' }}>
                <span className="ic" aria-hidden="true">🧰</span>
                Toolbox
              </button>
            )}
          </div>
          {view.opening.cards.map((c, i) =>
            open[i] ? (
              <div key={i} className="panel" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="label" style={{ color: 'var(--accent-ink)' }}>{c.icon ? `${c.icon} ` : ''}{c.label}</div>
                  <div>{c.text}</div>
                </div>
                <button className="btn ghost" aria-label={`Read ${c.label} aloud`} onClick={() => speak(`${c.label}. ${c.text}`)} style={{ minHeight: 40, padding: '4px 10px' }}><SpeakerIcon /></button>
              </div>
            ) : null,
          )}
          {showToolbox && view.blocks && (
            <div className="panel" style={{ padding: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>Building blocks · Budget {view.budgetLabel}</div>
              <div className="stack" style={{ gap: 6 }}>
                {view.blocks.map((b) => (
                  <div key={b.name}><strong>{b.name}:</strong> <span className="muted">{b.examples}</span></div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 15, marginTop: 8 }}>Ask for any cost or spec. Got another idea? Propose it.</div>
            </div>
          )}
            </>
          )}
          <p style={{ margin: 0, fontWeight: 600 }}>{view.opening.prompt}</p>
        </section>
      )}

      {!twoCol && view.board && view.board.length > 0 && (
        <section className="panel" style={{ padding: 12, marginBottom: 14 }} aria-label="Theory board">
          <div className="label" style={{ marginBottom: 8 }}>📌 Theory board</div>
          <div className="stack" style={{ gap: 10 }}>
            {view.board.map((b) => (
              <div key={b.theory} style={{ borderLeft: '4px solid var(--accent)', paddingLeft: 10 }}>
                <div style={{ fontWeight: 600 }}>{b.theory}</div>
                {b.supporting.length > 0 && <div style={{ fontSize: 15 }}><span style={{ color: 'var(--accent)', fontWeight: 600 }}>Backs it up:</span> {b.supporting.join(' · ')}</div>}
                {b.problems.length > 0 && <div style={{ fontSize: 15 }}><span style={{ color: 'var(--rust)', fontWeight: 600 }}>Doesn&apos;t fit:</span> {b.problems.join(' · ')}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {!twoCol && view.planLine && !view.design && (
        <div className="panel" style={{ padding: 12, marginBottom: 14, fontSize: 16 }}>
          <span className="label">💰 Plan so far</span> · {view.planLine}
        </div>
      )}

      {!twoCol && view.design && (
        <div className="panel" style={{ padding: 12, marginBottom: 14, fontSize: 15 }}>
          <span className="label">📐 Your design</span> · {view.design.line ?? `$${view.design.cost.toLocaleString()} · ~${view.design.liters.toLocaleString()} L/day`} · {view.design.valid ? 'ready' : 'not done yet'}
        </div>
      )}

      {!twoCol && view.stats && (
        <div className="row" style={{ gap: 8, marginBottom: 14 }} aria-label="Colony status">
          {view.stats.map((s) => (
            <div key={s.label} className="panel" style={{ padding: '6px 10px', fontSize: 14 }}>
              <span className="label" style={{ fontSize: 10 }}>{s.label}</span>
              {s.delta ? (
                <span aria-label={`${s.delta > 0 ? 'up' : 'down'} ${Math.abs(s.delta)}`} style={{ marginLeft: 6, fontWeight: 700, color: s.delta > 0 ? 'var(--accent)' : 'var(--rust)' }}>
                  {s.delta > 0 ? '↑' : '↓'}{Math.abs(s.delta)}
                </span>
              ) : null}
              {s.count ? (
                <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, lineHeight: 1 }}>{s.value}</div>
              ) : s.word ? (
                <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2, color: s.value <= 3 ? 'var(--rust)' : 'var(--ink)' }}>{s.word}</div>
              ) : (
                <div style={{ display: 'flex', gap: 2, marginTop: 4 }} aria-label={`${s.value} of 10`}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} style={{ width: 8, height: 12, borderRadius: 2, background: i < s.value ? (s.value <= 3 ? 'var(--rust)' : 'var(--accent)') : 'var(--rule)' }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="stack" aria-live="polite">
        {view.display.map((m, i) =>
                    m.source ? (
            <figure key={i} data-msg={i} className="source-card">
              <div className="source-head">
                <span>📜 Primary source</span>
                <button aria-label="Read the source aloud" onClick={() => speak(m.source!.modern)} className="icon-btn"><SpeakerIcon /></button>
              </div>
              <blockquote className="source-modern">“{m.source.modern}”</blockquote>
              <figcaption>
                {m.source.author}, <em>{m.source.title}</em> ({m.source.year})
                <details>
                  <summary>See the original spelling</summary>
                  <p className="source-original">“{m.source.original}”</p>
                  <a href={m.source.href} target="_blank" rel="noreferrer">Where this comes from</a>
                </details>
              </figcaption>
            </figure>
          ) : m.image ? (
            <figure key={i} data-msg={i} className="exhibit">
              <div className="label" style={{ color: 'var(--accent-ink)', padding: '8px 12px 0' }}>🖼️ Exhibit</div>
              <img src={m.image.src} alt={m.image.alt} style={{ objectFit: m.image.fit ?? 'cover' }} />
              <figcaption>
                <a href={m.image.href} target="_blank" rel="noreferrer">{m.image.credit}</a>
              </figcaption>
            </figure>
          ) : m.role === 'abi' ? (
            <div key={i} data-msg={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'var(--ink)', color: 'var(--paper)', padding: '10px 14px', borderRadius: '14px 14px 2px 14px' }}>{m.text}</div>
          ) : (
            <div key={i} data-msg={i} style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--rule)', borderLeft: '4px solid var(--accent)', padding: '10px 14px', borderRadius: '14px 14px 14px 2px', fontSize: 19 }}>
                <Rich text={m.text} />
              </div>
              <button aria-label="Read aloud" onClick={() => speak(m.text)} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', minHeight: 44, minWidth: 44 }}><SpeakerIcon /></button>
            </div>
          ),
        )}
        {busy && <div className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{THINKING[thinkIdx]}</div>}
        {view.decision && !busy && !closed && (
          <div className="panel stack" style={{ borderColor: 'var(--accent)', borderWidth: 2, background: 'var(--accent-soft)', gap: 10 }} role="group" aria-label="Your choices">
            <div className="label" style={{ color: 'var(--accent-ink)' }}>🧭 Decision {view.decision.number}{view.decision.title ? `: ${view.decision.title}` : ''} · {view.decision.when}</div>
            {view.decision.options.map((o) => (
              <button key={o.letter} className="choice-btn" onClick={() => send(undefined, `${o.letter}. ${o.label}`)}>
                <span className="choice-letter">{o.letter}</span>
                <span>
                  <strong>{o.label}</strong>
                  {o.detail ? <span style={{ display: 'block', color: 'var(--ink-2)', fontSize: 16 }}>{o.detail}</span> : null}
                </span>
              </button>
            ))}
            <div className="muted" style={{ fontSize: 15 }}>Or type your own plan below.</div>
          </div>
        )}

        {view.nextTest && !busy && !closed && (
          <div className="panel" style={{ borderColor: 'var(--accent)', borderWidth: 2, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn" style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} onClick={() => send(undefined, view.nextTest!.retest ? `Retest: ${view.nextTest!.name}` : `Run test ${view.nextTest!.n}: ${view.nextTest!.name}`)}>
              ▶ {view.nextTest.retest ? 'Retest' : view.nextTest.n === 1 ? 'Start testing' : 'Run next test'}
            </button>
            <span style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>🧪 Test {view.nextTest.n} of {view.nextTest.total}: {view.nextTest.name}</span>
          </div>
        )}
        {closed && (
          <div className="panel stack" style={{ borderColor: 'var(--rust)', borderWidth: 2 }}>
            <div className="label" style={{ color: 'var(--rust)' }}>Case closed</div>
            {view.hasSummary && <div><Link className="btn" href={`/files/${view.id}`}>See your Case Summary</Link></div>}
          </div>
        )}
        {closed && view.followUps && view.followUps.length > 0 && <KeepExploring questions={view.followUps} />}
        <div ref={bottom} />
      </section>
      </div>
      </div>

      <form onSubmit={send} className="no-print" style={{ position: 'fixed', left: 0, right: 0, bottom: 22, background: 'var(--paper)', borderTop: '2px solid var(--ink)', padding: '10px 16px' }}>
        <div style={{ maxWidth: twoCol ? 1180 : 760, margin: '0 auto' }} className={`stack${twoCol ? ' form-two' : ''}`}>
          {err && <div role="alert" style={{ color: 'var(--rust)', fontSize: 15 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <label htmlFor="msg" style={{ position: 'absolute', left: -9999 }}>Your message</label>
            <textarea
              id="msg"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={closed ? 'Ask a follow-up…' : listening ? 'Listening…' : 'Type or tap the mic…'}
              style={{ flex: 1 }}
            />
            {canTalk && (
              <button type="button" onClick={toggleListen} aria-label={listening ? 'Stop listening' : 'Talk instead of typing'} className="btn ghost" style={{ minWidth: 52, background: listening ? 'var(--rust)' : undefined, color: listening ? '#fff' : undefined }}><MicIcon /></button>
            )}
            <button className="btn" type="submit" disabled={busy || !text.trim()}>Send</button>
          </div>
          <label className="row muted" style={{ fontSize: 14, gap: 6 }}>
            <input type="checkbox" checked={autoRead} onChange={(e) => { setAutoRead(e.target.checked); try { localStorage.setItem('abi-autoread', e.target.checked ? '1' : '0'); } catch {} }} />
            Read replies aloud
          </label>
        </div>
      </form>
    </main>
  );
}
