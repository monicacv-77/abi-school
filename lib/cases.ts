// Case registry. Cases live as JSON in /cases, versioned in git.
// To add a case: drop a JSON file in /cases and import it here, in sequence order.
import type { CaseDef } from './types';
import c001 from '@/cases/001-clean-water.json';
import c003 from '@/cases/003-lost-colony.json';
import c005 from '@/cases/005-jamestown.json';

export const CASES: CaseDef[] = [c001, c003, c005] as unknown as CaseDef[];

// Cases planned for the unit but not written yet (shown on the dashboard).
export const PLANNED = [
  { id: '002', title: 'The Failing Farm', mode: 'investigation', unit: 'Early Settlements' },
  { id: '004', title: 'Build for Survival', mode: 'challenge', unit: 'Early Settlements' },
];

export function getCase(id: string): CaseDef | undefined {
  return CASES.find((c) => c.id === id);
}
