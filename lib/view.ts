// What the browser is allowed to see about a session (never the raw model conversation or hidden data).
import { caseFor } from './cases';
import { planKey, statWord } from './modes';
import type { ChallengeData, InvestigationData, Session, SimulationData } from './types';

export interface SessionView {
  id: string;
  caseId: string;
  title: string;
  mode: Session['mode'];
  status: Session['status'];
  display: Session['display'];
  number: string;
  classification: string;
  opening?: { intro: string; video?: { title: string; youtubeId: string; minutes: number; source: string }; cards: { icon?: string; label: string; text: string; kind?: 'brief' | 'place' | 'voice' }[]; prompt: string };
  evidence?: string[];
  startingIdea?: string;
  keyPoints?: string[];
  image?: { src: string; alt: string; credit: string; href: string; fit?: 'cover' | 'contain'; position?: string };
  blocks?: { name: string; examples: string }[];
  budget?: number;
  design?: { description: string; cost: number; liters: number; line?: string; valid: boolean } | null;
  budgetLabel?: string;
  planLine?: string;
  budgetBox?: {
    unit: string | null; // null = dollars
    budget: number;
    spent: number;
    items: { name: string; qty: number; cost: number }[];
    scarce?: { label: string; used: number; limit: number };
    capacity?: { value: number; target: number; label: string };
    days?: number;
    workers?: number;
    designed: boolean; // the list matches her last submitted design
    needs?: { icon: string; label: string; ok: boolean }[];
    ready?: boolean;
  };
  decision?: { when: string; number: number; title: string; options: { letter: string; label: string; detail?: string }[] };
  stats?: { label: string; value: number; count?: boolean; delta?: number; word?: string; dir?: 'up' | 'down' | 'same' }[];
  story?: { label: string; value: string; dir?: 'up' | 'down' | 'same' }[];
  lastChoice?: string;
  choices?: { n: number; label: string }[];
  winCondition?: string;
  board?: { theory: string; supporting: string[]; problems: string[] }[];
  question?: string;
  hasSummary: boolean;
  followUps?: string[];
}

export function toView(s: Session): SessionView {
  const c = caseFor(s);
  const v: SessionView = {
    id: s.id,
    caseId: s.caseId,
    title: c?.title ?? s.title,
    mode: s.mode,
    status: s.status,
    display: s.display,
    number: c?.id ?? 'Q',
    classification: c?.classification ?? 'Open Question',
    question: s.question,
    hasSummary: Boolean(s.summary),
    followUps: s.followUps,
    winCondition: c ? c.winCondition ?? (c.data as InvestigationData).winCondition : 'Figure it out and explain it in your own words.',
  };
  if (s.mode === 'inquiry') {
    v.startingIdea = s.state.startingIdea ? String(s.state.startingIdea) : undefined;
    v.keyPoints = Array.isArray(s.state.keyPoints) ? (s.state.keyPoints as string[]) : [];
  }
  if (c) {
    const rank = { brief: 0, place: 1, voice: 2 } as const;
    v.opening = { ...c.opening, cards: [...c.opening.cards].sort((a, b) => rank[a.kind ?? 'voice'] - rank[b.kind ?? 'voice']) };
    v.image = c.image;
  }
  if (c?.data.kind === 'challenge') {
    const d = c.data as ChallengeData;
    v.budget = d.budget;
    v.budgetLabel = d.units ? `${d.budget.toLocaleString('en-US')} ${d.units.cost}${d.units.scarce ? ` · ${d.units.scarce.limit} ${d.units.scarce.label}` : ''}` : `$${d.budget.toLocaleString('en-US')}`;
    v.blocks = d.buildingBlocks;
    v.design = (s.state.design as SessionView['design']) ?? null;
    const plan = Array.isArray(s.state.plan) ? (s.state.plan as { id: string; qty: number }[]) : [];
    const custom = Array.isArray(s.state.planCustom) ? (s.state.planCustom as { name: string; cost: number; scarce?: number }[]) : [];
    const short = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, '');
    const items = [
      ...plan.map((p) => {
        const t = d.toolbox.find((x) => x.id === p.id);
        return { name: short(t?.name ?? p.id), qty: p.qty, cost: (t?.cost ?? 0) * p.qty, scarce: (t?.scarce ?? 0) * p.qty };
      }),
      ...custom.map((c) => ({ name: short(c.name), qty: 1, cost: c.cost, scarce: c.scarce ?? 0 })),
    ];
    const des = s.state.design as { key?: string; capacity?: number; target?: number; days?: number; valid?: boolean } | null;
    const designed = Boolean(des?.key && des.key === planKey(plan, custom));
    v.budgetBox = {
      unit: d.units?.cost ?? null,
      budget: d.budget,
      spent: items.reduce((sum, i) => sum + i.cost, 0),
      items: items.map(({ name, qty, cost }) => ({ name, qty, cost })),
      scarce: d.units?.scarce ? { label: d.units.scarce.label, used: +items.reduce((sum, i) => sum + i.scarce, 0).toFixed(2), limit: d.units.scarce.limit } : undefined,
      workers: d.units?.workers,
      designed,
      capacity: designed && des ? { value: des.capacity ?? 0, target: des.target ?? 0, label: d.units?.capacity ?? 'L/day of safe water' } : undefined,
      days: designed && des?.days ? des.days : undefined,
      ready: designed ? Boolean(des?.valid) : undefined,
      needs: d.needs?.map((n) => {
        const have = new Set([...plan.map((p) => p.id), ...custom.flatMap((c) => (c as { counts_as?: string[] }).counts_as ?? [])]);
        if (n.fullCapacity) {
          const cap = plan.reduce((sum, p) => {
            const t = d.toolbox.find((x) => x.id === p.id);
            return n.anyOf.includes(p.id) && t ? sum + (t.capacity ?? t.capacityLitersPerDay ?? 0) * Math.min(p.qty, t.max ?? p.qty) : sum;
          }, 0);
          const target = d.minCapacity ?? d.minLitersPerDay ?? 0;
          return { icon: n.icon, label: `${n.label}${cap ? ` (${cap.toLocaleString('en-US')} so far)` : ''}`, ok: cap >= target && cap > 0 };
        }
        return { icon: n.icon, label: n.label, ok: n.anyOf.some((id) => have.has(id)) };
      }),
    };
    if (plan.length) {
      const cost = plan.reduce((sum, p) => sum + (d.toolbox.find((t) => t.id === p.id)?.cost ?? 0) * p.qty, 0);
      const fmt = (n: number) => (d.units ? `${n.toLocaleString('en-US')} ${d.units.cost}` : `$${n.toLocaleString('en-US')}`);
      const scarce = d.units?.scarce ? +plan.reduce((sum, p) => sum + (d.toolbox.find((t) => t.id === p.id)?.scarce ?? 0) * p.qty, 0).toFixed(2) : 0;
      v.planLine = `${fmt(cost)} of ${fmt(d.budget)} · ${fmt(d.budget - cost)} left${d.units?.scarce ? ` · ${scarce} of ${d.units.scarce.limit} ${d.units.scarce.label}` : ''}`;
    }
  }
  if (c?.data.kind === 'investigation') {
    const d = c.data as InvestigationData;
    const named = (x: string) => d.evidence.find((e) => e.id === x)?.label ?? x;
    v.board = ((s.state.board as SessionView['board']) ?? []).map((b) => ({ ...b, supporting: b.supporting.map(named), problems: b.problems.map(named) }));
    v.evidence = (Array.isArray(s.state.examined) ? (s.state.examined as string[]) : []).map((id) => d.evidence.find((e) => e.id === id)?.label ?? id);
  }
  if (c?.data.kind === 'simulation') {
    const d = c.data as SimulationData;
    const stats = (s.state.stats ?? {}) as Record<string, number>;
    const delta = (s.state.lastDelta ?? {}) as Record<string, number>;
    const pend = s.state.pendingDecision ? d.decisions.find((x) => x.id === s.state.pendingDecision) : undefined;
    const pendOpts = Array.isArray(s.state.pendingOptions) ? (s.state.pendingOptions as { letter: string; label: string; detail?: string }[]) : null;
    if (pend)
      v.decision = {
        when: pend.when,
        number: Number(s.state.decisionNumber) || (Array.isArray(s.state.choices) ? s.state.choices.length + 1 : 1),
        title: String(s.state.pendingTitle || ''),
        options: pendOpts?.length ? pendOpts.map((o) => ({ letter: o.letter, label: o.label, detail: o.detail })) : pend.options.map((o, i) => ({ letter: 'ABCD'[i], label: o.label })),
      };
    const started = Array.isArray(s.state.choices) && s.state.choices.length > 0;
    v.stats = d.stats.map((x) => {
      const dv = delta[x.id];
      return { label: x.label, value: stats[x.id] ?? x.start, count: x.kind === 'count', delta: dv, word: x.kind === 'count' ? undefined : statWord(x, stats[x.id] ?? x.start), dir: !started ? undefined : dv > 0 ? 'up' : dv < 0 ? 'down' : 'same' };
    });
    v.lastChoice = s.state.lastChoice ? String(s.state.lastChoice) : undefined;
    v.choices = (Array.isArray(s.state.choices) ? (s.state.choices as { choice: string }[]) : []).map((ch, i) => ({ n: i + 1, label: ch.choice }));
    const st = (s.state.story ?? {}) as Record<string, { value: string; dir?: 'up' | 'down' | 'same' }>;
    const STORY = [['water', '💧 Water'], ['food_production', '🌾 Food production'], ['settlement', '🏠 Settlement'], ['profit', '🪙 Profit']] as const;
    v.story = Object.keys(st).length
      ? STORY.filter(([k]) => st[k]).map(([k, label]) => ({ label, value: st[k].value, dir: st[k].dir }))
      : storyLines(s.display.map((m) => m.text)); // older games kept these in the chat card
  }
  return v;
}

// The guide's latest "Your Colony" card holds story lines the game doesn't count (water, settlement…).
// Pull those out for the side panel. Lines the game already tracks are skipped.
const TRACKED = /colonist|people|^food$|health|powhatan|investor/i;
function parseCard(text: string): { label: string; value: string; tag?: string }[] | null {
  const paras = text.split(/\n{2,}/);
  for (let i = paras.length - 1; i >= 0; i--) {
    const lines = paras[i].split('\n');
    if (!/your colony/i.test(lines[0].replace(/\*/g, ''))) continue;
    const out: { label: string; value: string; tag?: string }[] = [];
    for (const l of lines.slice(1)) {
      const m = l.replace(/\*/g, '').match(/^\s*(.+?):\s*(.+?)\s*(?:\((better|worse|same)\))?\s*$/i);
      if (!m) continue;
      const bare = m[1].replace(/[^\p{L}\s]/gu, '').trim();
      if (TRACKED.test(bare)) continue;
      out.push({ label: m[1].trim(), value: m[2].trim(), tag: m[3]?.toLowerCase() });
    }
    return out.length ? out : null;
  }
  return null;
}
function storyLines(texts: string[]): SessionView['story'] {
  const cards: { label: string; value: string; tag?: string }[][] = [];
  for (const t of texts) {
    const c = t ? parseCard(t) : null;
    if (c) cards.push(c);
  }
  const last = cards.at(-1);
  if (!last) return undefined;
  const prev = cards.at(-2);
  return last.map((l) => {
    const before = prev?.find((p) => p.label === l.label);
    const dir = l.tag === 'better' ? 'up' : l.tag === 'worse' ? 'down' : l.tag === 'same' ? 'same' : before && before.value === l.value ? 'same' : undefined;
    return { label: l.label, value: l.value, dir };
  });
}
