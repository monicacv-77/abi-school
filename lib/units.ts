// Units: the big ideas each unit is really about. The Supervisor's unit review asks about these.
export interface UnitDef {
  name: string; // must match the cases' "unit" field
  title: string; // shown to Abi
  bigIdeas: { idea: string; cases: string[] }[]; // each idea, and the cases where Abi met it
}

export const UNITS: UnitDef[] = [
  {
    name: 'Early Settlements',
    title: 'Unit 1: Early Settlements',
    bigIdeas: [
      { idea: 'Survival depends on whole systems, not one fix: water, food and shelter each fail at their weakest link.', cases: ['001', '002', '004', '005'] },
      { idea: 'The environment decides what works: local knowledge and local materials beat assumptions brought from far away.', cases: ['002', '004', '005'] },
      { idea: 'Every design or decision is a tradeoff: it buys something and costs something.', cases: ['001', '004', '005'] },
      { idea: "Ask who's telling the story and what they want: people with something to sell or protect shape what they say.", cases: ['003', '005'] },
      { idea: 'Problems stack up and make each other worse: disaster usually comes from several causes at once, not one bad decision.', cases: ['002', '005'] },
      { idea: 'The Powhatan and other Native nations had their own knowledge, technology and interests; the colony depended on them more than the Company admitted.', cases: ['002', '003', '005'] },
    ],
  },
];

export function getUnit(name?: string) {
  return UNITS.find((u) => u.name === name);
}
