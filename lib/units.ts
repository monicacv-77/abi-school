// Units: the big ideas each unit is really about. The Supervisor's unit review asks about these.
export interface UnitDef {
  name: string; // must match the cases' "unit" field
  title: string; // shown to Abi
  bigIdeas: { idea: string; cases: string[] }[]; // each idea, and the cases where Abi met it
  thin?: number[]; // 1-based numbers of ideas the cases only touch lightly so far
}

export const UNITS: UnitDef[] = [
  {
    name: 'Early Settlements',
    title: 'Unit 1: Early Settlements',
    bigIdeas: [
      { idea: 'North America was already populated by established societies with governments, trade, farming, technology and religion. The Powhatan were a political and economic power, not people the English simply "met."', cases: ['002', '005'] },
      { idea: 'The Columbian Exchange permanently changed the world: plants, animals, people and diseases crossed the Atlantic both ways (corn and potatoes to Europe; horses, cattle, wheat and smallpox to the Americas), helping some peoples and devastating others.', cases: ['002'] },
      { idea: 'Colonization was driven by economic and political ambitions. Jamestown was a business paid for by investors who expected profit, and that shaped where settlers went, what they did and how they treated Native peoples.', cases: ['003', '005'] },
      { idea: 'Survival depended on geography, resources and relationships: safe water, farmland, labor, supplies and the Powhatan. Outcomes rarely come from one decision, and solving one problem can create another.', cases: ['001', '002', '004', '005'] },
      { idea: 'Colonization fundamentally changed Native life. Every settlement story has at least two sides: what the English called expansion meant losing land, security and sovereignty for the people already there.', cases: ['005'] },
      { idea: 'Colonial America was built on both opportunity and exploitation. Tobacco made Virginia profitable but demanded land and labor; in 1619 the first recorded Africans arrived and Virginia\'s first elected assembly met.', cases: ['005'] },
    ],
    thin: [2, 5, 6], // ideas the cases only touch lightly so far: ask gently, or skip
  },
];

export function getUnit(name?: string) {
  return UNITS.find((u) => u.name === name);
}
