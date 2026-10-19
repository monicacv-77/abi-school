// "How it went": a quick read of a session for the Parent dashboard, so Mom doesn't have to read the transcript.
import type { Session } from './types';

const IDLE_CAP_MS = 10 * 60 * 1000; // a gap longer than 10 minutes counts as a break, not work time

export function sessionInsights(s: Session) {
  const d = s.display.filter((m) => m.at);
  let activeMs = 0;
  let longest = { ms: 0, after: '' };
  for (let i = 1; i < d.length; i++) {
    const gap = new Date(d[i].at).getTime() - new Date(d[i - 1].at).getTime();
    if (gap > 0) activeMs += Math.min(gap, IDLE_CAP_MS);
    // Where she paused longest: a guide message followed by her next message (breaks over 10 min don't count).
    if (d[i].role === 'abi' && d[i - 1].role === 'guide' && gap < IDLE_CAP_MS * 3 && gap > longest.ms) longest = { ms: gap, after: d[i - 1].text };
  }
  const abiMsgs = d.filter((m) => m.role === 'abi');
  const advisor = Number(s.state.hintsAsked) || abiMsgs.filter((m) => m.text.startsWith('🧑‍🏫')).length;
  const results = Array.isArray(s.state.results) ? (s.state.results as { passed: boolean }[]) : [];
  const short = (t: string) => {
    const plain = t.replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
    return plain.length > 160 ? plain.slice(0, 157) + '…' : plain;
  };
  return {
    minutes: Math.max(1, Math.round(activeMs / 60000)),
    days: new Set(d.map((m) => m.at.slice(0, 10))).size,
    messages: abiMsgs.length,
    advisor,
    testsFailed: results.filter((r) => !r.passed).length,
    redesigns: Math.max(0, (Number(s.state.designCount) || 0) - 1),
    evidence: Array.isArray(s.state.examined) ? (s.state.examined as string[]).length : undefined,
    decisions: Array.isArray(s.state.choices) ? (s.state.choices as unknown[]).length : undefined,
    longestPause: longest.ms > 90 * 1000 ? { minutes: Math.round(longest.ms / 60000), after: short(longest.after) } : null,
  };
}
