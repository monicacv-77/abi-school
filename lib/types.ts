// Shared types for Abi School.

export type Mode = 'challenge' | 'investigation' | 'simulation' | 'inquiry';
export type CaseStatus = 'READY' | 'DRAFT' | 'HOLD' | 'PILOT';

export interface OpeningCard {
  label: string; // e.g. "WATER TECHNICIAN"
  text: string; // one or two short sentences
}

export interface Opening {
  intro: string; // the hook: 1–3 short sentences shown first
  video?: { title: string; youtubeId: string; minutes: number; source: string }; // optional short context video
  cards: OpeningCard[]; // tap-to-open cards
  prompt: string; // the hand-off question
}

/** Fields every authored case shares. Mode-specific data sits in `data`. */
export interface CaseDef {
  id: string; // "001"
  title: string;
  mode: Exclude<Mode, 'inquiry'>;
  classification: string; // "Design Problem", "Unexplained Event", ...
  unit: string;
  location?: string;
  realOrConstructed: string;
  status: CaseStatus;
  version: number;
  bigUnderstanding: string; // hidden
  opening: Opening;
  facilitatorNotes: string[]; // hidden, case-specific rules
  justInTimeConcepts: string[];
  scaffolds: string[]; // light → stronger
  completion: string; // what must happen before close_case is allowed
  endReveal: { concept: string; vocabulary: { term: string; meaning: string }[]; realVsConstructed: { real: string; constructed: string } };
  skills: string[];
  timelineEvents?: { year: string; label: string }[];
  followUpSeeds?: string[]; // directions for the end-of-case 'Keep exploring' questions
  data: ChallengeData | InvestigationData | SimulationData;
}

// ---------- Challenge ----------
export interface ToolboxItem {
  id: string;
  name: string;
  cost: number;
  capacityLitersPerDay?: number; // safe water added (or enabled) per day, if any
  provides: string; // what it does, short
  needs?: string[]; // ids this item depends on to work ("a|b" = either; "existing:x" = already there)
  limitedBy?: string[]; // capacity counts only up to the total quantity of these items (e.g. one pump per borehole)
  maintenance?: string;
  hidden?: boolean; // never mentioned unless Abi proposes this idea herself
}
export interface Measurement {
  id: string;
  label: string; // "Test the shallow wells"
  result: string; // what is found
  conditions?: string; // when this result applies
}
export interface StressTest {
  id: string;
  order: number;
  name: string;
  scenario: string; // short, for the facilitator to narrate
  passesIf: string; // how to judge
  hiddenDetail?: string; // revealed only if Abi investigates
}
export interface ChallengeData {
  kind: 'challenge';
  budget: number;
  targets: { id: string; label: string; check: string }[];
  minLitersPerDay?: number;
  buildingBlocks: { name: string; examples: string }[]; // what Abi sees: categories, no prices
  toolbox: ToolboxItem[];
  measurements: Measurement[];
  stressTests: StressTest[];
  existingResources: string[];
  environment: string[]; // physical facts only — no consequences spelled out
}

// ---------- Investigation ----------
export interface EvidenceItem {
  id: string;
  label: string; // how Abi would ask for it
  howToGet: string; // inspect / test / ask / read
  result: string;
}
export interface InvestigationData {
  kind: 'investigation';
  question: string;
  resolved: boolean; // false = real unsolved mystery: no answer key, any evidence-backed verdict can win
  winCondition: string; // shown to Abi
  trueExplanation: string; // hidden — may be "unresolved" for real history
  causalChain?: string[];
  evidence: EvidenceItem[];
  theories: { theory: string; supportedBy: string[]; weakenedBy: string[] }[];
  redHerrings?: string[];
}

// ---------- Simulation ----------
export interface StatDef {
  id: string;
  label: string;
  start: number; // 0–10
}
export interface DecisionOption {
  id: string;
  label: string;
  effects: Record<string, number>; // stat deltas
  consequence: string; // what happens
}
export interface DecisionPoint {
  id: string;
  when: string; // date/moment
  situation: string;
  options: DecisionOption[];
}
export interface SimulationData {
  kind: 'simulation';
  role: string;
  setting: string;
  canKnow: string;
  cannotKnow: string;
  people: { name: string; who: string; voice: string; real: boolean }[];
  dailyLife: string[];
  stats: StatDef[];
  fixedEvents: { id: string; when: string; event: string }[]; // happen regardless
  decisions: DecisionPoint[];
  scienceHooks?: string[];
  historyComparison: string; // for the end
}

// ---------- Sessions ----------
export interface ApiMessage {
  role: 'user' | 'assistant';
  content: unknown; // Anthropic content (string or blocks)
}

export interface DisplayMessage {
  role: 'abi' | 'guide';
  text: string;
  at: string;
}

export interface CaseSummary {
  number: string;
  title: string;
  classification: string;
  method: string;
  hook: string;
  quote: string; // Abi's best insight, her words
  quoteLabel: string;
  visual: { kind: 'chain' | 'list' | 'compare'; title: string; items: string[]; itemsB?: string[]; labelA?: string; labelB?: string };
  foundTitle: string;
  found: string[];
  keyIdeas: { term: string; meaning: string }[];
  skills: string[];
  realOrConstructed: string;
  closedAt: string;
}

export interface ParentRecord {
  whatHappened: string;
  scaffoldsUsed: string;
  concepts: string[];
  notes: string;
}

export interface Session {
  id: string;
  caseId: string; // "001", or "inquiry"
  caseVersion: number;
  mode: Mode;
  title: string;
  status: 'active' | 'closed';
  startedAt: string;
  updatedAt: string;
  stage: string;
  api: ApiMessage[]; // full conversation as sent to the model
  display: DisplayMessage[]; // what Abi sees
  state: Record<string, unknown>; // mode state (design, revealed, stats, ...)
  question?: string; // inquiry
  summary?: CaseSummary;
  followUps?: string[]; // 'Keep exploring' questions offered after closing
  parent?: ParentRecord;
  isTest?: boolean; // started from the parent dashboard
}

export interface SessionIndexEntry {
  id: string;
  caseId: string;
  title: string;
  mode: Mode;
  status: 'active' | 'closed';
  startedAt: string;
  updatedAt: string;
  isTest?: boolean;
}

export interface WonderItem {
  id: string;
  question: string;
  createdAt: string;
  status: 'open' | 'explored';
  sessionId?: string;
}
