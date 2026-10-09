// Sessions, progress, Wonder List and timeline, stored as JSON.
import { randomUUID } from 'crypto';
import { readJSON, writeJSON } from './store';
import { CASES, caseFor, getCase } from './cases';
import { ENGINES, FIRST_STAGE, type ReviewCase } from './modes';
import type { Session, SessionIndexEntry, WonderItem } from './types';

const INDEX = 'sessions/index.json';
const WONDERS = 'wonders.json';
const TIMELINE = 'timeline.json';

export async function listSessions(): Promise<SessionIndexEntry[]> {
  return (await readJSON<SessionIndexEntry[]>(INDEX)) ?? [];
}

export async function getSession(id: string): Promise<Session | null> {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return null;
  return readJSON<Session>(`sessions/${id}.json`);
}

export async function saveSession(s: Session): Promise<void> {
  s.updatedAt = new Date().toISOString();
  await writeJSON(`sessions/${s.id}.json`, s);
  const index = await listSessions();
  const entry: SessionIndexEntry = {
    id: s.id,
    caseId: s.caseId,
    title: s.title,
    mode: s.mode,
    status: s.status,
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
    isTest: s.isTest,
  };
  const i = index.findIndex((e) => e.id === s.id);
  if (i >= 0) index[i] = entry;
  else index.push(entry);
  await writeJSON(INDEX, index);
}

/** The next case in sequence: lowest READY case Abi hasn't completed (test runs don't count). */
export async function nextCase() {
  const sessions = (await listSessions()).filter((s) => !s.isTest);
  const done = new Set(sessions.filter((s) => s.status === 'closed').map((s) => s.caseId));
  const active = sessions.filter((s) => s.status === 'active' && s.caseId !== 'inquiry' && s.caseId !== 'review').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const next = CASES.filter((c) => c.status === 'READY' && !done.has(c.id)).sort((a, b) => a.id.localeCompare(b.id))[0];
  return { active, next };
}

export async function startCaseSession(caseId: string, isTest = false): Promise<Session> {
  const c = getCase(caseId);
  if (!c) throw new Error('Unknown case');
  const now = new Date().toISOString();
  const s: Session = {
    id: randomUUID(),
    caseId: c.id,
    caseVersion: c.version,
    mode: c.mode,
    title: c.title,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    stage: FIRST_STAGE[c.mode],
    api: [],
    display: [],
    state: ENGINES[c.mode].initialState(c as never),
    isTest,
    caseSnapshot: JSON.parse(JSON.stringify(c)),
  };
  await saveSession(s);
  return s;
}

export async function startInquiry(question: string, wonderId?: string, isTest = false): Promise<Session> {
  const now = new Date().toISOString();
  const s: Session = {
    id: randomUUID(),
    caseId: 'inquiry',
    caseVersion: 1,
    mode: 'inquiry',
    title: question.length > 70 ? question.slice(0, 67) + '…' : question,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    stage: FIRST_STAGE.inquiry,
    api: [],
    display: [],
    state: ENGINES.inquiry.initialState(),
    question,
    isTest,
  };
  await saveSession(s);
  if (wonderId) {
    const list = await listWonders();
    const w = list.find((x) => x.id === wonderId);
    if (w) {
      w.status = 'explored';
      w.sessionId = s.id;
      await writeJSON(WONDERS, list);
    }
  }
  return s;
}

// ---- Supervisor review
/** How many cases Abi has closed since her last review (test runs don't count). The Supervisor drops in at 2. */
export async function reviewStatus() {
  const sessions = (await listSessions()).filter((x) => !x.isTest && x.status === 'closed');
  const lastReview = sessions.filter((x) => x.caseId === 'review').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const cases = sessions.filter((x) => x.caseId !== 'review');
  const since = cases.filter((x) => !lastReview || x.updatedAt > lastReview.updatedAt).length;
  return { due: cases.length >= 2 && since >= 2, closedCases: cases.length, since };
}

export async function startReview(isTest = false): Promise<Session> {
  const all = await listSessions();
  const pool = all.filter((x) => x.status === 'closed' && x.caseId !== 'review' && (isTest || !x.isTest));
  // When was each case last reviewed? Least-recently reviewed (then oldest) come first.
  const reviews = (await Promise.all(all.filter((x) => x.caseId === 'review' && x.status === 'closed').map((x) => getSession(x.id)))).filter(Boolean) as Session[];
  const lastSeen = new Map<string, string>();
  for (const r of reviews) for (const rc of (r.state.reviewCases as ReviewCase[]) ?? []) if ((lastSeen.get(rc.sessionId) ?? '') < r.updatedAt) lastSeen.set(rc.sessionId, r.updatedAt);
  const picked = pool.sort((a, b) => (lastSeen.get(a.id) ?? '').localeCompare(lastSeen.get(b.id) ?? '') || a.updatedAt.localeCompare(b.updatedAt)).slice(0, 3);
  if (!picked.length) throw new Error('No closed cases to review yet.');
  const reviewCases: ReviewCase[] = [];
  for (const p of picked) {
    const full = await getSession(p.id);
    if (!full?.summary) continue;
    const c = caseFor(full);
    reviewCases.push({
      sessionId: full.id,
      caseId: full.caseId,
      title: c?.title ?? full.title,
      mode: full.mode,
      closedAt: full.updatedAt,
      hook: full.summary.hook,
      found: full.summary.found,
      quote: full.summary.quote,
      inYourWords: full.summary.inYourWords,
      bigUnderstanding: c?.bigUnderstanding,
      concept: c?.endReveal.concept,
      vocabulary: c?.endReveal.vocabulary,
    });
  }
  if (!reviewCases.length) throw new Error('No closed cases to review yet.');
  const now = new Date().toISOString();
  const s: Session = {
    id: randomUUID(),
    caseId: 'review',
    caseVersion: 1,
    mode: 'review',
    title: `Supervisor review: ${reviewCases.map((r) => r.title).join(', ')}`,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    stage: FIRST_STAGE.review,
    api: [],
    display: [],
    state: { answers: [], reviewCases, questionCount: reviewCases.length === 1 ? 3 : reviewCases.length === 2 ? 4 : 5 },
    isTest,
  };
  await saveSession(s);
  return s;
}

// ---- Wonder List
export async function listWonders(): Promise<WonderItem[]> {
  return (await readJSON<WonderItem[]>(WONDERS)) ?? [];
}
export async function addWonder(question: string): Promise<WonderItem> {
  const list = await listWonders();
  const item: WonderItem = { id: randomUUID(), question: question.trim().slice(0, 300), createdAt: new Date().toISOString(), status: 'open' };
  list.push(item);
  await writeJSON(WONDERS, list);
  return item;
}

// ---- Timeline
export interface TimelineItem {
  year: string;
  label: string;
  caseId: string;
  caseTitle: string;
  at: string;
}
export async function listTimeline(): Promise<TimelineItem[]> {
  return (await readJSON<TimelineItem[]>(TIMELINE)) ?? [];
}
export async function addTimeline(item: Omit<TimelineItem, 'at'>): Promise<void> {
  const list = await listTimeline();
  if (list.some((x) => x.year === item.year && x.label.toLowerCase() === item.label.toLowerCase())) return;
  list.push({ ...item, at: new Date().toISOString() });
  await writeJSON(TIMELINE, list);
}

/** Sort key for years like "1607", "May 1607", "Jan 1608". */
export function yearKey(y: string): number {
  const m = y.match(/(\d{3,4})/);
  const year = m ? Number(m[1]) : 9999;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const mi = months.findIndex((mo) => y.toLowerCase().includes(mo));
  return year * 100 + (mi >= 0 ? mi + 1 : 0);
}
