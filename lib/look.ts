// Visual identity for each kind of case: emoji, name and accent colors.
import type { Mode } from './types';

export const MODE_LOOK: Record<Mode, { emoji: string; name: string; tagline: string; accent: string; soft: string; ink: string }> = {
  investigation: { emoji: '🔎', name: 'Investigation', tagline: 'Figure it out', accent: '#1d5d8f', soft: '#e3eef8', ink: '#123b5c' },
  challenge: { emoji: '🛠️', name: 'Challenge', tagline: 'Make it work', accent: '#b4501a', soft: '#fbeadd', ink: '#6e2f0d' },
  simulation: { emoji: '🧭', name: 'Simulation', tagline: 'Live the history', accent: '#6b3fa0', soft: '#efe6f8', ink: '#432668' },
  inquiry: { emoji: '💡', name: 'Question', tagline: 'Ask anything', accent: '#2c7a4b', soft: '#e2f3e8', ink: '#1a4d2f' },
};

export function lookFor(mode: Mode) {
  return MODE_LOOK[mode];
}

/** CSS variables for a mode, applied on a wrapper. */
export function modeVars(mode: Mode): React.CSSProperties {
  const l = MODE_LOOK[mode];
  return { ['--accent' as string]: l.accent, ['--accent-soft' as string]: l.soft, ['--accent-ink' as string]: l.ink } as React.CSSProperties;
}
