// Units: the big ideas each unit is really about. The Supervisor's unit review asks about these.
export interface UnitDef {
  name: string; // must match the cases' "unit" field
  title: string; // shown to Abi
  years: [number, number]; // when the unit's history happens (for the Timeline)
  blurb: string; // one line for the Timeline
  planned?: boolean; // on the Timeline as 'coming up', no cases yet
  bigIdeas: { idea: string; cases: string[] }[]; // each idea, and the cases where Abi met it
  thin?: number[]; // 1-based numbers of ideas the cases only touch lightly so far
}

export const UNITS: UnitDef[] = [
  {
    name: 'Early Settlements',
    title: 'Unit 1: Early Settlements',
    years: [1607, 1610],
    blurb: 'Jamestown: water, food, shelter, the Powhatan, and survival.',
    bigIdeas: [
      { idea: 'North America was already populated by established societies with governments, trade, farming, technology and religion. The Powhatan were a political and economic power, not people the English simply "met."', cases: ['002', '005'] },
      { idea: 'The Columbian Exchange permanently changed the world: plants, animals, people and diseases crossed the Atlantic both ways (corn and potatoes to Europe; horses, cattle, wheat and smallpox to the Americas), helping some peoples and devastating others.', cases: ['002', '005'] },
      { idea: 'Survival depended on geography, resources and relationships: safe water, farmland, labor, supplies and the Powhatan. Outcomes rarely come from one decision, and solving one problem can create another.', cases: ['001', '002', '004', '005'] },
      { idea: 'Colonization fundamentally changed Native life. Every settlement story has at least two sides: what the English called expansion meant losing land, security and sovereignty for the people already there.', cases: ['002', '005'] },
    ],
  },
  { name: 'Road to Independence', title: 'Unit 2: Road to Independence', years: [1765, 1776], blurb: 'Taxes, propaganda, alarms in the night, and a declaration.', planned: true, bigIdeas: [] },
  { name: 'The Constitution', title: 'The Constitution', years: [1787, 1787], blurb: 'Designing a government that checks its own power.', planned: true, bigIdeas: [] },
  { name: 'Westward', title: 'The Young Nation Heads West', years: [1803, 1806], blurb: 'Lewis and Clark pack for the unknown.', planned: true, bigIdeas: [] },
];

export function getUnit(name?: string) {
  return UNITS.find((u) => u.name === name);
}
