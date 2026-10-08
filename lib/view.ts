// What the browser is allowed to see about a session (never the raw model conversation or hidden data).
import { caseFor } from './cases';
import { statWord } from './modes';
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
  decision?: { when: string; options: { letter: string; label: string }[] };
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
    const pendOpts = Array.isArray(s.state.pendingOptions) ? (s.state.pendingOptions as { letter: string; label: string }[]) : null;
    if (pend) v.decision = { when: pend.when, options: pendOpts?.length ? pendOpts.map((o) => ({ letter: o.letter, label: o.label })) : pend.options.map((o, i) => ({ letter: 'ABCD'[i], label: o.label })) };
    v.stats = d.stats.map((x) => ({ label: x.label, value: stats[x.id] ?? x.start, count: x.kind === 'count', delta: delta[x.id], word: x.kind === 'count' ? undefined : statWord(x, stats[x.id] ?? x.start) }));
  }
  return v;
}
