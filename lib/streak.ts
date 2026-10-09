// Weekly streaks: the goal is 5 cases closed per week (Mon–Sun, Monica's time zone). Any day counts,
// so weekends can catch up. A streak is consecutive weeks that reached the goal; the current week
// never breaks it while it's still in progress.
import type { SessionIndexEntry } from './types';

export const WEEKLY_GOAL = 5;
const TZ = 'America/Los_Angeles';

function localParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) };
}

/** The Monday (YYYY-MM-DD, local) of the week containing this moment. */
export function weekKey(iso: string | Date) {
  const { y, m, d, wd } = localParts(new Date(iso));
  const monday = new Date(Date.UTC(y, m - 1, d - wd));
  return monday.toISOString().slice(0, 10);
}

function prevWeek(key: string) {
  const t = new Date(key + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() - 7);
  return t.toISOString().slice(0, 10);
}

/** Cases (not questions or reviews) that count toward the weekly goal. */
export function countsTowardGoal(s: SessionIndexEntry) {
  return s.status === 'closed' && !s.isTest && s.caseId !== 'inquiry' && s.caseId !== 'review';
}

export function weeklyStats(sessions: SessionIndexEntry[], now = new Date()) {
  const perWeek = new Map<string, number>();
  for (const s of sessions.filter(countsTowardGoal)) {
    const k = weekKey(s.closedAt ?? s.updatedAt);
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  const thisWeek = weekKey(now);
  const thisCount = perWeek.get(thisWeek) ?? 0;
  let streak = thisCount >= WEEKLY_GOAL ? 1 : 0;
  for (let k = prevWeek(thisWeek); (perWeek.get(k) ?? 0) >= WEEKLY_GOAL; k = prevWeek(k)) streak++;
  const weekday = localParts(now).wd; // 0 = Monday … 6 = Sunday
  const recent: { week: string; count: number }[] = [];
  for (let k = thisWeek, i = 0; i < 8; i++, k = prevWeek(k)) recent.push({ week: k, count: perWeek.get(k) ?? 0 });
  return { goal: WEEKLY_GOAL, thisCount, streak, weekend: weekday >= 5, recent };
}
