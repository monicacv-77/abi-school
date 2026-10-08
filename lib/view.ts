// What the browser is allowed to see about a session (never the raw model conversation or hidden data).
import { caseFor } from './cases';
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
  stats?: { label: string; value: number; count?: boolean; delta?: number }[];
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
  }
  if (c?.data.kind === 'investigation') {
    v.board = (s.state.board as SessionView['board']) ?? [];
  }
  if (c?.data.kind === 'simulation') {
    const d = c.data as SimulationData;
    const stats = (s.state.stats ?? {}) as Record<string, number>;
    const delta = (s.state.lastDelta ?? {}) as Record<string, number>;
    v.stats = d.stats.map((x) => ({ label: x.label, value: stats[x.id] ?? x.start, count: x.kind === 'count', delta: delta[x.id] }));
  }
  return v;
}
