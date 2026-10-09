import type { CaseSummary } from '@/lib/types';

const arrow = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#1E5560" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto' }}>
    <path d="M2 7h9M8 4l3 3-3 3" />
  </svg>
);

const METHOD_EMOJI: Record<string, string> = { Investigation: '🔎', Challenge: '🛠️', Simulation: '🧭', Inquiry: '💡' };

export default function CaseSummaryPage({ s }: { s: CaseSummary }) {
  const closed = new Date(s.closedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <article className="summary">
      <div className="sum-top">
        <div>Abi&apos;s Case Files</div>
        <div>{s.number === 'Q' ? 'Open Question' : `Case ${s.number}`}</div>
      </div>
      <div className="stamp">CLOSED</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 150 }}>
        <div>
          <span className="tag" style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>{METHOD_EMOJI[s.method] ?? ''} {s.method}</span>
          <span className="tag">{s.classification}</span>
        </div>
        <h1 className="sum-title">{s.title}</h1>
        <p style={{ margin: 0, fontSize: 17, color: 'var(--ink-2)' }}>{s.hook}</p>
      </div>

      <div className="sum-quote">
        <div className="qmark">“</div>
        <div>
          <p style={{ margin: 0, fontSize: 22, lineHeight: 1.35, fontWeight: 500 }}>{s.quote}</p>
          <div className="label" style={{ color: '#c9c4b8', marginTop: 10 }}>{s.quoteLabel}</div>
        </div>
      </div>

      {s.inYourWords && (
        <div className="sum-words">
          <div className="label">✍️ In my words</div>
          <p>{s.inYourWords}</p>
        </div>
      )}

      {s.visual.items.length > 0 && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="label">{s.visual.title}</div>
          {s.visual.kind === 'chain' && (
            <div className="chain">
              {s.visual.items.map((it, i) => (
                <div key={i} style={{ display: 'contents' }}>
                  {i > 0 && arrow}
                  <div className={`chip${i === s.visual.items.length - 1 ? ' last' : ''}`}>{it}</div>
                </div>
              ))}
            </div>
          )}
          {s.visual.kind === 'list' && (
            <ol className="steps">
              {s.visual.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ol>
          )}
          {s.visual.kind === 'compare' && (
            <div className="compare">
              <div>
                <div className="label" style={{ marginBottom: 6 }}>{s.visual.labelA ?? 'Before'}</div>
                <ul>{s.visual.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6, color: 'var(--teal)' }}>{s.visual.labelB ?? 'After'}</div>
                <ul>{(s.visual.itemsB ?? []).map((it, i) => <li key={i}>{it}</li>)}</ul>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="two">
        <div>
          <div className="col-h">{s.foundTitle}</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.45 }}>
            {s.found.map((f, i) => <li key={i} style={{ marginBottom: 6 }}>{f}</li>)}
          </ul>
        </div>
        <div>
          <div className="col-h">Key ideas</div>
          <div style={{ fontSize: 14, lineHeight: 1.45 }}>
            {s.keyIdeas.map((k, i) => (
              <div key={i} style={{ marginBottom: 8 }}><strong>{k.term}</strong> — {k.meaning}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="sum-foot">
        <div>
          <div className="label" style={{ fontSize: 11, marginBottom: 8 }}>Skills</div>
          <div className="row" style={{ gap: 6 }}>
            {s.skills.map((k) => <span key={k} className="pill">{k}</span>)}
          </div>
        </div>
        <div style={{ maxWidth: 320, fontSize: 12, lineHeight: 1.45, color: '#4a4c47', textAlign: 'right' }}>
          <div className="label" style={{ fontSize: 11, color: 'var(--ink)' }}>Real or constructed?</div>
          {s.realOrConstructed}
          <div style={{ marginTop: 4 }}>Closed {closed}</div>
          {s.standards && s.standards.length > 0 && (
            <div style={{ marginTop: 6 }} title={s.standards.map((x) => `${x.code}: ${x.label}`).join('\n')}>
              <span className="label" style={{ fontSize: 11, color: 'var(--ink)' }}>Standards: </span>
              {s.standards.map((x) => x.code).join(' · ')}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
