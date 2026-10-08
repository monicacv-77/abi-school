// What the browser is allowed to see about a session (never the raw model conversation or hidden data).
import { getCase } from './cases';
import type { ChallengeData, Session, SimulationData } from './types';

export interface SessionView {
  id: string;
  caseId: string;
  title: string;
  mode: Session['mode'];
  status: Session['status'];
  display: Session['display'];
  number: string;
  classification: string;
  opening?: { intro: string; cards: { label: string; text: string }[]; prompt: string };
  toolbox?: { name: string; cost: number; capacity?: number; provides: string }[];
  budget?: number;
  design?: { description: string; cost: number; liters: number; valid: boolean } | null;
  stats?: { label: string; value: number }[];
  question?: string;
  hasSummary: boolean;
}

export function toView(s: Session): SessionView {
  const c = s.caseId === 'inquiry' ? undefined : getCase(s.caseId);
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
  };
  if (c) v.opening = c.opening;
  if (c?.data.kind === 'challenge') {
    const d = c.data as ChallengeData;
    v.budget = d.budget;
    v.toolbox = d.toolbox.map((t) => ({ name: t.name, cost: t.cost, capacity: t.capacityLitersPerDay, provides: t.provides }));
    v.design = (s.state.design as SessionView['design']) ?? null;
  }
  if (c?.data.kind === 'simulation') {
    const d = c.data as SimulationData;
    const stats = (s.state.stats ?? {}) as Record<string, number>;
    v.stats = d.stats.map((x) => ({ label: x.label, value: stats[x.id] ?? x.start }));
  }
  return v;
}
