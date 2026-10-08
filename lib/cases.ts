// Case registry. Cases live as JSON in /cases, versioned in git.
// To add a case: drop a JSON file in /cases and import it here, in sequence order.
import type { CaseDef, Session } from './types';
import c001 from '@/cases/001-clean-water.json';
import c002 from '@/cases/002-failing-farm.json';
import c003 from '@/cases/003-too-good-to-be-true.json';
import c004 from '@/cases/004-build-for-survival.json';
import b1 from '@/cases/bonus-lost-colony.json';
import c005 from '@/cases/005-jamestown.json';

export const CASES: CaseDef[] = [c001, c002, c003, c004, c005, b1] as unknown as CaseDef[];

// Cases planned for the unit but not written yet (shown on the dashboard).
export const PLANNED: { id: string; title: string; mode: string; unit: string }[] = [];

export function getCase(id: string): CaseDef | undefined {
  return CASES.find((c) => c.id === id);
}

/** The case a session should use: its own snapshot (version lock), falling back to the current file. */
export function caseFor(s: Pick<Session, 'caseId' | 'caseSnapshot'>): CaseDef | undefined {
  if (s.caseId === 'inquiry') return undefined;
  return s.caseSnapshot ?? getCase(s.caseId);
}
