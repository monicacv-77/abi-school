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
  opening?: { intro: string; video?: { title: string; youtubeId: string; minutes: number; source: string }; cards: { icon?: string; label: string; text: string }[]; prompt: string };
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
    ready?: boolean;
  };
  decision?: { when: string; number: number; title: string; options: { letter: string; label: string; detail?: string }[] };
  stats?: { label: string; value: number; count?: boolean; delta?: number; word?: string }[];
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
  if (c) {
    v.opening = c.opening;
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
    };
    if (plan.length) {
      const cost = plan.reduce((sum, p) => sum + (d.toolbox.find((t) => t.id === p.id)?.cost ?? 0) * p.qty, 0);
      const fmt = (n: number) => (d.units ? `${n.toLocaleString('en-US')} ${d.units.cost}` : `$${n.toLocaleString('en-US')}`);
      const scarce = d.units?.scarce ? +plan.reduce((sum, p) => sum + (d.toolbox.find((t) => t.id === p.id)?.scarce ?? 0) * p.qty, 0).toFixed(2) : 0;
      v.planLine = `${fmt(cost)} of ${fmt(d.budget)} · ${fmt(d.budget - cost)} left${d.units?.scarce ? ` · ${scarce} of ${d.units.scarce.limit} ${d.units.scarce.label}` : ''}`;
    }
  }
  if (c?.data.kind === 'investigation') {
    v.board = (s.state.board as SessionView['board']) ?? [];
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
    v.stats = d.stats.map((x) => ({ label: x.label, value: stats[x.id] ?? x.start, count: x.kind === 'count', delta: delta[x.id], word: x.kind === 'count' ? undefined : statWord(x, stats[x.id] ?? x.start) }));
  }
  return v;
}
