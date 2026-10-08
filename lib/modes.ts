// The four mode engines. Each one defines:
//  - rules: how the AI behaves in this mode
//  - tools: game actions the AI can take (results come from case data, not improvisation)
//  - handle(): executes a tool against the case data and session state, enforcing stage rules
//  - spec(): the case text the AI sees (hidden results are NOT included; they come back only through tools)
//  - canClose(): what must have happened before the case can close
import type Anthropic from '@anthropic-ai/sdk';
import type {
  CaseDef,
  ChallengeData,
  InvestigationData,
  Mode,
  Session,
  SimulationData,
} from './types';

type Tool = Anthropic.Messages.Tool;
export interface ToolOutcome {
  result: string;
  isError?: boolean;
}

// ---------------------------------------------------------------- shared tools
const CLOSE_CASE: Tool = {
  name: 'close_case',
  description:
    "Close the case and write Abi's one-page Case Summary (first person, as Abi, short and plain, her own words wherever possible) plus a private record for her mom. Only call this after the completion criteria are met and Abi has stated her own final conclusion in her words.",
  input_schema: {
    type: 'object',
    properties: {
      abi_final_words: { type: 'string', description: "Abi's own final conclusion/decision/explanation, quoted from what she said, lightly cleaned up." },
      hook: { type: 'string', description: 'One or two sentences a stranger understands, first person. E.g. "Hundreds of fish suddenly died in Lake Mason. My job was to figure out why."' },
      quote: { type: 'string', description: "Abi's single best insight, in her words. Under 30 words." },
      quote_label: { type: 'string', description: 'Label under the quote, e.g. "My conclusion", "My final design", "What I figured out".' },
      visual: {
        type: 'object',
        description:
          'The one visual for this mode. chain = cause-and-effect steps (Investigation); list = design components or decision path (Challenge/Simulation); compare = two columns (Simulation: my colony vs real history; Inquiry: what I thought at first vs what I figured out).',
        properties: {
          kind: { type: 'string', enum: ['chain', 'list', 'compare'] },
          title: { type: 'string' },
          items: { type: 'array', items: { type: 'string' }, description: '3–7 very short items' },
          label_a: { type: 'string' },
          label_b: { type: 'string' },
          items_b: { type: 'array', items: { type: 'string' } },
        },
        required: ['kind', 'title', 'items'],
      },
      found_title: { type: 'string', description: 'e.g. "What I found", "How it held up", "Key moments"' },
      found: { type: 'array', items: { type: 'string' }, description: '3–6 short bullets of what Abi actually found, tested or decided' },
      key_ideas: {
        type: 'array',
        items: { type: 'object', properties: { term: { type: 'string' }, meaning: { type: 'string' } }, required: ['term', 'meaning'] },
        description: '2–4 terms that became relevant, each defined in under 15 plain words',
      },
      skills: { type: 'array', items: { type: 'string' }, description: '2–3 skills, e.g. "Cause & Effect", "Using Evidence", "Design Thinking"' },
      follow_ups: {
        type: 'array',
        items: { type: 'string' },
        description:
          "Exactly 3 'Keep exploring' questions Abi might want to ask next, written as she would ask them (under 12 words each, plain words). Make them different: one deeper science/technology question, one 'how does this work today' question, one people/history question. Build on what she was curious about in this case and the case's follow-up directions. They appear as buttons, so don't list them in your reply.",
      },
      parent_what_happened: { type: 'string', description: 'For her mom: 3–5 sentences on what Abi did, where she struggled, what clicked.' },
      parent_scaffolds_used: { type: 'string', description: 'Hints you had to give, if any.' },
      parent_concepts: { type: 'array', items: { type: 'string' }, description: 'Academic concepts covered, for the curriculum index.' },
    },
    required: ['abi_final_words', 'hook', 'quote', 'quote_label', 'visual', 'found_title', 'found', 'follow_ups', 'parent_what_happened'],
  },
};

const SAVE_WONDER: Tool = {
  name: 'save_wonder',
  description: "Save a question Abi wonders about to her Wonder List for later, when she asks to save it or agrees to. Don't chase it now.",
  input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
};

const PIN_TIMELINE: Tool = {
  name: 'pin_to_timeline',
  description:
    "Pin a real historical event to Abi's timeline when it genuinely comes up in the case (real history only, never invented events). Keep the label under 10 words.",
  input_schema: {
    type: 'object',
    properties: { year: { type: 'string', description: 'e.g. "1607" or "May 1607"' }, label: { type: 'string' } },
    required: ['year', 'label'],
  },
};

// ---------------------------------------------------------------- helpers
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
function pushUnique(state: Record<string, unknown>, key: string, value: string) {
  const list = arr<string>(state[key]);
  if (!list.includes(value)) list.push(value);
  state[key] = list;
}
const money = (n: number) => '$' + n.toLocaleString('en-US');

// ---------------------------------------------------------------- CHALLENGE
const challenge = {
  rules: `
MODE: CHALLENGE — "Make it work." Abi is the engineer. Backbone: Define → Design → Build → Test → Improve.
- You play the project team and the laws of physics. Be fair and realistic.
- Abi's screen shows the opening cards and a short list of BUILDING BLOCKS (categories only, no prices). She must ask for costs, capacities and specs; when she does, call look_up and answer briefly. Never recite the whole toolbox or offer a menu of products.
- Items marked HIDDEN exist so her own ideas can be priced fairly. Never mention, hint at or suggest them; only price one if Abi herself proposes that idea.
- Anything measured on site (water tests, how much a source yields, what's happening in homes) she must ask for. Use take_measurement and report the result in 1–3 sentences.
- Never hand her multiple-choice designs. She invents the design. Unconventional ideas are fine if physically plausible: give a fair game cost/capacity consistent with the toolbox scale.
- When she proposes a design, call submit_design. Report cost, daily capacity and any missing pieces. If it's over budget or under target, tell her the engineering result and let her fix it.
- After a valid design, say it's ready and ask if she wants to test it. Then run stress tests in order with run_stress_test, one at a time. Narrate the scenario briefly, ask what happens to her system, let her reason, then judge fairly using the test's pass rule. If her design already handles a test, say so: don't manufacture failure.
- After a failed test she may redesign: call submit_design again, then retest as needed.
- Finish with the case's final question, get her reasoning, then close.
`.trim(),
  tools: (): Tool[] => [
    {
      name: 'look_up',
      description: "Look up the game cost, capacity and notes for items Abi asks about. Only for things she named or clearly described.",
      input_schema: { type: 'object', properties: { item_ids: { type: 'array', items: { type: 'string' } } }, required: ['item_ids'] },
    },
    {
      name: 'take_measurement',
      description: 'Do an on-site measurement or inspection Abi asked for. Returns the actual result from the case data.',
      input_schema: { type: 'object', properties: { measurement_id: { type: 'string' } }, required: ['measurement_id'] },
    },
    {
      name: 'submit_design',
      description: "Record Abi's design and compute its cost and daily capacity. Use toolbox item ids with quantities. For a reasonable idea not in the toolbox, add it as a custom item with a fair cost/capacity.",
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'One-sentence summary of her design in plain words' },
          items: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' }, qty: { type: 'integer', minimum: 1 } }, required: ['id', 'qty'] },
          },
          custom_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, cost: { type: 'number' }, liters_per_day: { type: 'number' }, provides: { type: 'string' } },
              required: ['name', 'cost'],
            },
          },
        },
        required: ['description', 'items'],
      },
    },
    {
      name: 'run_stress_test',
      description: 'Run the next stress test on the current design. Returns the scenario and how to judge it.',
      input_schema: { type: 'object', properties: { test_id: { type: 'string' } }, required: ['test_id'] },
    },
  ],
  spec(c: CaseDef): string {
    const d = c.data as ChallengeData;
    return [
      `Budget: ${money(d.budget)}. ${d.minLitersPerDay ? `Minimum game target: ${d.minLitersPerDay.toLocaleString()} liters/day.` : ''}`,
      `Success targets:\n${d.targets.map((t) => `- ${t.label}: ${t.check}`).join('\n')}`,
      `Existing resources:\n${d.existingResources.map((r) => `- ${r}`).join('\n')}`,
      `Environment (physical facts shown to Abi):\n${d.environment.map((r) => `- ${r}`).join('\n')}`,
      `Building blocks shown to Abi (categories only): ${d.buildingBlocks.map((b) => `${b.name} (${b.examples})`).join('; ')}`,
      `Toolbox ids for mapping her ideas (game prices, not real quotes; details come from look_up):\n${d.toolbox
        .map((t) => `- ${t.id}: ${t.name}${t.hidden ? ' [HIDDEN — only if Abi proposes it]' : ''}`)
        .join('\n')}`,
      `Measurements Abi can ask for (results are hidden — call take_measurement):\n${d.measurements.map((m) => `- ${m.id}: ${m.label}`).join('\n')}`,
      `Stress tests, in order (scenarios hidden — call run_stress_test only after a valid design):\n${d.stressTests
        .sort((a, b) => a.order - b.order)
        .map((s) => `- ${s.id}: ${s.name}`)
        .join('\n')}`,
    ].join('\n\n');
  },
  initialState: () => ({ revealed: [], design: null, testsRun: [], designCount: 0 }),
  handle(name: string, input: any, s: Session, c: CaseDef): ToolOutcome | null {
    const d = c.data as ChallengeData;
    if (name === 'look_up') {
      const ids = arr<string>(input.item_ids);
      const found = d.toolbox.filter((t) => ids.includes(t.id));
      if (!found.length) return { result: `No matching items. Valid ids: ${d.toolbox.map((x) => x.id).join(', ')}`, isError: true };
      for (const t of found) pushUnique(s.state, 'lookedUp', t.id);
      return {
        result: found
          .map((t) => `${t.name}: ${money(t.cost)}${t.capacityLitersPerDay ? `, about ${t.capacityLitersPerDay.toLocaleString()} L/day` : ''}. ${t.provides}${t.needs ? ` Needs: ${t.needs.map((n) => n.replace(/\|/g, ' or ').replace('existing:', '')).join(', ')}.` : ''}${t.maintenance ? ` Upkeep: ${t.maintenance}` : ''}`)
          .join('\n'),
      };
    }
    if (name === 'take_measurement') {
      const m = d.measurements.find((x) => x.id === input.measurement_id);
      if (!m) return { result: `No measurement "${input.measurement_id}". Valid ids: ${d.measurements.map((x) => x.id).join(', ')}`, isError: true };
      pushUnique(s.state, 'revealed', m.id);
      if (s.stage === 'define') s.stage = 'design';
      return { result: `${m.label}: ${m.result}${m.conditions ? ` (${m.conditions})` : ''}` };
    }
    if (name === 'submit_design') {
      const lines: string[] = [];
      let cost = 0;
      let liters = 0;
      const chosen = new Map<string, number>();
      for (const it of arr<{ id: string; qty: number }>(input.items)) {
        const t = d.toolbox.find((x) => x.id === it.id);
        if (!t) return { result: `Unknown toolbox id "${it.id}". Valid ids: ${d.toolbox.map((x) => x.id).join(', ')}`, isError: true };
        chosen.set(t.id, (chosen.get(t.id) ?? 0) + Math.max(1, it.qty || 1));
      }
      const missing: string[] = [];
      for (const [id, qty] of chosen) {
        const t = d.toolbox.find((x) => x.id === id)!;
        cost += t.cost * qty;
        // Each need is a toolbox id, or alternatives written "a|b", or "existing:<thing>" (already available).
        const needsMet = (t.needs ?? []).every((n) => n.split('|').some((alt) => alt.startsWith('existing:') || chosen.has(alt)));
        let usable = qty;
        if (t.limitedBy?.length) {
          const cap = t.limitedBy.reduce((sum, id) => sum + (chosen.get(id) ?? 0), 0);
          if (cap < qty) missing.push(`only ${cap} of ${qty} × ${t.name} can be used (one per ${t.limitedBy.join(' or ')})`);
          usable = Math.min(qty, cap);
        }
        if (t.capacityLitersPerDay && needsMet) liters += t.capacityLitersPerDay * usable;
        if (!needsMet) missing.push(`${t.name} won't work without: ${(t.needs ?? []).map((n) => n.replace(/\|/g, ' or ')).join(' and ')}`);
        lines.push(`${qty} × ${t.name} = ${money(t.cost * qty)}`);
      }
      for (const ci of arr<{ name: string; cost: number; liters_per_day?: number; provides?: string }>(input.custom_items)) {
        cost += ci.cost;
        liters += ci.liters_per_day ?? 0;
        lines.push(`custom: ${ci.name} = ${money(ci.cost)}${ci.liters_per_day ? `, ${ci.liters_per_day} L/day` : ''}`);
      }
      const overBudget = cost > d.budget;
      const underTarget = d.minLitersPerDay ? liters < d.minLitersPerDay : false;
      const valid = !overBudget && !underTarget && missing.length === 0;
      s.state.design = { description: input.description, lines, cost, liters, valid };
      s.state.designCount = (Number(s.state.designCount) || 0) + 1;
      s.stage = valid ? (arr(s.state.testsRun).length ? 'improve' : 'build') : 'design';
      return {
        result: [
          `Design: ${input.description}`,
          ...lines,
          `Total cost: ${money(cost)} of ${money(d.budget)} budget${overBudget ? ` — OVER by ${money(cost - d.budget)}` : ''}.`,
          `Safe water capacity: about ${liters.toLocaleString()} L/day${d.minLitersPerDay ? ` (target ${d.minLitersPerDay.toLocaleString()})${underTarget ? ' — BELOW TARGET' : ''}` : ''}.`,
          missing.length ? `Missing pieces: ${missing.join('; ')}` : '',
          valid ? 'Design is valid and ready to test.' : 'Design is not valid yet. Tell Abi the engineering result; let her fix it.',
          'Note: capacity is a simple game estimate. It does not by itself prove access, safety at home, reliability or maintenance — the stress tests check those.',
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }
    if (name === 'run_stress_test') {
      const design = s.state.design as { valid?: boolean } | null;
      if (!design?.valid) return { result: 'Cannot run a stress test yet: there is no valid design. Help Abi finish her design first.', isError: true };
      const sorted = [...d.stressTests].sort((a, b) => a.order - b.order);
      const done = arr<string>(s.state.testsRun);
      const t = sorted.find((x) => x.id === input.test_id);
      if (!t) return { result: `Unknown test. Valid ids: ${sorted.map((x) => x.id).join(', ')}`, isError: true };
      const next = sorted.find((x) => !done.includes(x.id));
      if (!done.includes(t.id) && next && next.id !== t.id) return { result: `Run tests in order. Next test is "${next.id}".`, isError: true };
      pushUnique(s.state, 'testsRun', t.id);
      s.stage = 'test';
      return {
        result: `STRESS TEST — ${t.name}\nScenario (narrate briefly): ${t.scenario}\nHow to judge: ${t.passesIf}${t.hiddenDetail ? `\nOnly if Abi investigates, reveal: ${t.hiddenDetail}` : ''}\nTests remaining after this: ${sorted.filter((x) => !arr<string>(s.state.testsRun).includes(x.id)).map((x) => x.id).join(', ') || 'none'}`,
      };
    }
    return null;
  },
  status(s: Session, c: CaseDef) {
    const d = c.data as ChallengeData;
    const design = s.state.design as { description: string; cost: number; liters: number; valid: boolean } | null;
    return `Stage: ${s.stage}. Measurements taken: ${arr<string>(s.state.revealed).join(', ') || 'none'}. ${
      design ? `Current design: "${design.description}", ${money(design.cost)}, ~${design.liters} L/day, ${design.valid ? 'valid' : 'not valid'}.` : 'No design yet.'
    } Stress tests run: ${arr<string>(s.state.testsRun).join(', ') || 'none'} of ${d.stressTests.length}.`;
  },
  canClose(s: Session, c: CaseDef): string | null {
    const d = c.data as ChallengeData;
    const design = s.state.design as { valid?: boolean } | null;
    if (!design?.valid) return 'There is no valid design yet.';
    const need = Math.min(3, d.stressTests.length);
    if (arr(s.state.testsRun).length < need) return `Run at least ${need} stress tests first (run so far: ${arr(s.state.testsRun).length}).`;
    return null;
  },
};

// ---------------------------------------------------------------- INVESTIGATION
const investigation = {
  rules: `
MODE: INVESTIGATION — "Figure it out." Abi is the investigator. Backbone: Question → Evidence → Hypothesis → Conclusion.
- You play the lab, the archive and the witnesses.
- Abi decides what to look at. When she asks for something that matches an evidence item, call examine and report the result in 1–3 sentences. If she asks for something the case doesn't have, give a short plausible answer that doesn't change the case.
- Never list what she should investigate. No multiple choice.
- The evidence never changes to fit her theory.
- When she proposes an explanation, call record_theory. Don't demand a theory after every clue.
- If her explanation is incomplete, point to the evidence it doesn't explain and let her revise.
- She may ask for an evidence summary anytime: give a short list of what she has found.
- When she proposes or changes a theory, call record_theory with the clues that support it and the clues that are a problem for it (only clues she has actually examined). Her Theory Board on screen shows this.
- SOLVED cases (there is a real answer): if her explanation is incomplete, point to evidence it doesn't explain and let her revise.
- UNSOLVED cases: there is no answer key. Never say a theory is wrong, incorrect or unlikely to be right. Show the evidence for and against and let her weigh it. She wins by making a case (verdict, supporting clues, one clue that doesn't fit and how she explains it, confidence). Any theory backed that way wins.
`.trim(),
  tools: (): Tool[] => [
    {
      name: 'examine',
      description: 'Examine an evidence item Abi asked about. Returns the actual evidence from the case data.',
      input_schema: { type: 'object', properties: { evidence_id: { type: 'string' } }, required: ['evidence_id'] },
    },
    {
      name: 'record_theory',
      description: "Record Abi's theory (her words) on her Theory Board, with the clues she has examined that support it and the clues that are a problem for it. Call again with the same theory text to update it.",
      input_schema: {
        type: 'object',
        properties: {
          theory: { type: 'string' },
          supporting: { type: 'array', items: { type: 'string' }, description: 'short clue names, e.g. "CROATOAN carving"' },
          problems: { type: 'array', items: { type: 'string' } },
        },
        required: ['theory'],
      },
    },
  ],
  spec(c: CaseDef): string {
    const d = c.data as InvestigationData;
    return [
      `The question: ${d.question}`,
      d.resolved ? 'This is a SOLVED case: there is a real answer.' : 'This is an UNSOLVED case: no answer key. Any evidence-backed verdict wins.',
      `Win condition (shown to Abi): ${d.winCondition}`,
      `${d.resolved ? 'The real explanation (HIDDEN — for judging only)' : 'Background for you (HIDDEN — NOT an answer key)'}: ${d.trueExplanation}`,
      d.causalChain ? `Cause-and-effect chain (hidden): ${d.causalChain.join(' → ')}` : '',
      `Theories Abi might consider:\n${d.theories.map((t) => `- ${t.theory} | supported by: ${t.supportedBy.join(', ') || '—'} | weakened by: ${t.weakenedBy.join(', ') || '—'}`).join('\n')}`,
      `Evidence available (results hidden — call examine):\n${d.evidence.map((e) => `- ${e.id}: ${e.label} [${e.howToGet}]`).join('\n')}`,
      d.redHerrings?.length ? `Red herrings: ${d.redHerrings.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  },
  initialState: () => ({ examined: [], theories: [] }),
  handle(name: string, input: any, s: Session, c: CaseDef): ToolOutcome | null {
    const d = c.data as InvestigationData;
    if (name === 'examine') {
      const e = d.evidence.find((x) => x.id === input.evidence_id);
      if (!e) return { result: `No evidence "${input.evidence_id}". Valid ids: ${d.evidence.map((x) => x.id).join(', ')}`, isError: true };
      pushUnique(s.state, 'examined', e.id);
      s.stage = 'evidence';
      return { result: `${e.label}: ${e.result}` };
    }
    if (name === 'record_theory') {
      const board = arr<{ theory: string; supporting: string[]; problems: string[] }>(s.state.board);
      const entry = { theory: String(input.theory), supporting: arr<string>(input.supporting).map(String), problems: arr<string>(input.problems).map(String) };
      const i = board.findIndex((b) => b.theory.toLowerCase() === entry.theory.toLowerCase());
      if (i >= 0) board[i] = entry;
      else board.push(entry);
      s.state.board = board;
      s.state.theories = board.map((b) => b.theory);
      s.stage = 'hypothesis';
      return { result: 'On her Theory Board.' };
    }
    return null;
  },
  status(s: Session, c: CaseDef) {
    const d = c.data as InvestigationData;
    return `Stage: ${s.stage}. Evidence examined (${arr(s.state.examined).length}/${d.evidence.length}): ${arr<string>(s.state.examined).join(', ') || 'none'}. Theories so far: ${arr<string>(s.state.theories).map((t) => `"${t}"`).join(' → ') || 'none'}.`;
  },
  canClose(s: Session): string | null {
    if (arr(s.state.examined).length < 3) return 'Abi has examined fewer than 3 pieces of evidence.';
    if (!arr(s.state.theories).length) return 'Abi has not stated a theory yet (record_theory).';
    return null;
  },
};

// ---------------------------------------------------------------- SIMULATION
const simulation = {
  rules: `
MODE: SIMULATION — "Live the history." Abi is a participant inside a real historical world. Backbone: Role → Situation → Decision → Consequence → Adapt.
- You are the world: narrator, the people she meets, the setting. Not a coach.
- Immersion first. Small, vivid, true details (smells, heat, bugs, food, the work) in a sentence or two, not paragraphs.
- Real people talk in character, briefly, with personality. A little humor is welcome when it's historically honest.
- Abi only knows what someone in her role could know. No modern hindsight from characters. If Abi uses what she learned in class, characters react as people of their time would.
- History is mechanisms: when it matters, let her see WHY things happen (incentives, orders from investors, disease, weather, relationships).
- Present one decision at a time, with the 3–4 options from the case, in very short form. She may also propose her own choice. Call make_choice to get the consequence and stat changes, then narrate.
- Real historical events happen on schedule: call advance_time to bring the next fixed event in when the story reaches it.
- Her version of history may differ from what really happened. The setting and facts stay accurate.
- At the end, compare her outcome with what really happened, briefly.
`.trim(),
  tools: (): Tool[] => [
    {
      name: 'make_choice',
      description: "Apply Abi's choice at a decision point. Use option_id for one of the case's options, or custom_choice for her own idea (then give small, fair stat effects).",
      input_schema: {
        type: 'object',
        properties: {
          decision_id: { type: 'string' },
          option_id: { type: 'string' },
          custom_choice: { type: 'string' },
          custom_effects: { type: 'object', description: 'stat id → change, each between -2 and 2', additionalProperties: { type: 'number' } },
        },
        required: ['decision_id'],
      },
    },
    {
      name: 'advance_time',
      description: 'Bring in the next real historical event when the story reaches it. Returns what happens.',
      input_schema: { type: 'object', properties: { event_id: { type: 'string' } }, required: ['event_id'] },
    },
  ],
  spec(c: CaseDef): string {
    const d = c.data as SimulationData;
    return [
      `Abi's role: ${d.role}`,
      `Setting: ${d.setting}`,
      `She can know: ${d.canKnow}\nShe cannot know: ${d.cannotKnow}`,
      `People:\n${d.people.map((p) => `- ${p.name}${p.real ? ' (real)' : ' (invented)'}: ${p.who}. Voice: ${p.voice}`).join('\n')}`,
      `Daily life details to weave in:\n${d.dailyLife.map((x) => `- ${x}`).join('\n')}`,
      d.scienceHooks?.length ? `Science hooks (let her investigate these if she's curious):\n${d.scienceHooks.map((x) => `- ${x}`).join('\n')}` : '',
      `Stats (0–10, shown on her screen): ${d.stats.map((x) => x.label).join(', ')}`,
      `Real events, in order (details hidden — call advance_time):\n${d.fixedEvents.map((e) => `- ${e.id}: ${e.when}`).join('\n')}`,
      `Decision points, in order:\n${d.decisions
        .map((dp) => `- ${dp.id} (${dp.when}): ${dp.situation}\n  Options: ${dp.options.map((o) => `${o.id} = ${o.label}`).join(' | ')}`)
        .join('\n')}`,
      `For the ending comparison (don't reveal early): ${d.historyComparison}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  },
  initialState: (c: CaseDef) => {
    const d = c.data as SimulationData;
    return { stats: Object.fromEntries(d.stats.map((x) => [x.id, x.start])), choices: [], events: [] };
  },
  handle(name: string, input: any, s: Session, c: CaseDef): ToolOutcome | null {
    const d = c.data as SimulationData;
    const stats = (s.state.stats ?? {}) as Record<string, number>;
    const clamp = (n: number) => Math.max(0, Math.min(10, n));
    if (name === 'make_choice') {
      const dp = d.decisions.find((x) => x.id === input.decision_id);
      if (!dp) return { result: `Unknown decision. Valid ids: ${d.decisions.map((x) => x.id).join(', ')}`, isError: true };
      if (arr<{ decision: string }>(s.state.choices).some((ch) => ch.decision === dp.id)) return { result: 'That decision was already made.', isError: true };
      let effects: Record<string, number> = {};
      let consequence = '';
      let label = '';
      if (input.option_id) {
        const o = dp.options.find((x) => x.id === input.option_id);
        if (!o) return { result: `Unknown option. Valid: ${dp.options.map((x) => x.id).join(', ')}`, isError: true };
        effects = o.effects;
        consequence = o.consequence;
        label = o.label;
      } else if (input.custom_choice) {
        for (const [k, v] of Object.entries((input.custom_effects ?? {}) as Record<string, number>)) {
          if (k in stats) effects[k] = Math.max(-2, Math.min(2, Number(v) || 0));
        }
        label = String(input.custom_choice);
        consequence = 'Abi chose her own path. Narrate a fair, historically plausible consequence.';
      } else return { result: 'Give option_id or custom_choice.', isError: true };
      const changes: string[] = [];
      for (const [k, v] of Object.entries(effects)) {
        if (!(k in stats)) continue;
        stats[k] = clamp(stats[k] + v);
        const st = d.stats.find((x) => x.id === k);
        changes.push(`${st?.label ?? k} ${v > 0 ? '↑' : '↓'}${Math.abs(v)}`);
      }
      s.state.stats = stats;
      s.state.choices = [...arr(s.state.choices), { decision: dp.id, choice: label }];
      s.stage = 'decision';
      return { result: `Choice: ${label}\nConsequence: ${consequence}\nStat changes: ${changes.join(', ') || 'none'}\nStats now: ${d.stats.map((x) => `${x.label} ${stats[x.id]}`).join(', ')}` };
    }
    if (name === 'advance_time') {
      const e = d.fixedEvents.find((x) => x.id === input.event_id);
      if (!e) return { result: `Unknown event. Valid ids: ${d.fixedEvents.map((x) => x.id).join(', ')}`, isError: true };
      pushUnique(s.state, 'events', e.id);
      return { result: `${e.when}: ${e.event}` };
    }
    return null;
  },
  status(s: Session, c: CaseDef) {
    const d = c.data as SimulationData;
    const stats = (s.state.stats ?? {}) as Record<string, number>;
    return `Stats: ${d.stats.map((x) => `${x.label} ${stats[x.id]}`).join(', ')}. Decisions made: ${arr<{ decision: string; choice: string }>(s.state.choices).map((c) => `${c.decision}: ${c.choice}`).join('; ') || 'none'}. Events so far: ${arr<string>(s.state.events).join(', ') || 'none'}. Remaining decisions: ${d.decisions.filter((dp) => !arr<{ decision: string }>(s.state.choices).some((c) => c.decision === dp.id)).map((dp) => dp.id).join(', ') || 'none'}.`;
  },
  canClose(s: Session, c: CaseDef): string | null {
    const d = c.data as SimulationData;
    const need = Math.ceil(d.decisions.length / 2);
    if (arr(s.state.choices).length < need) return `Make at least ${need} decisions first.`;
    return null;
  },
};

// ---------------------------------------------------------------- INQUIRY
const inquiry = {
  rules: `
MODE: INQUIRY — "Ask a question." Abi brought her own question. You are her mentor. Backbone: Question → What do you think now? → Explore → Explain → Next question.
- First draw out what she already thinks (call record_starting_idea once she says it).
- Use Socratic questions that move her forward, one at a time. Build on her idea or gently correct it.
- Don't withhold forever: if she's stuck after a couple of tries, explain clearly in a few sentences, then ask her to use it.
- Correct common myths. Be honest about what scientists or historians know vs. what's still debated.
- Help her land on her own explanation, in her words. Then offer one "next question" she might want to save to her Wonder List.
- If the question is outside what's appropriate for her age, or personal (health, feelings, relationships), gently suggest she talk to her mom.
- Close when she has stated her explanation in her own words (it's fine if the case is short).
`.trim(),
  tools: (): Tool[] => [
    {
      name: 'record_starting_idea',
      description: "Record what Abi thought at first, in her words, before exploring.",
      input_schema: { type: 'object', properties: { idea: { type: 'string' } }, required: ['idea'] },
    },
  ],
  spec(_c: CaseDef | null, s?: Session): string {
    return `Abi's question: "${s?.question ?? ''}"`;
  },
  initialState: () => ({ startingIdea: null }),
  handle(name: string, input: any, s: Session): ToolOutcome | null {
    if (name === 'record_starting_idea') {
      s.state.startingIdea = String(input.idea);
      s.stage = 'explore';
      return { result: 'Recorded.' };
    }
    return null;
  },
  status(s: Session) {
    return `Stage: ${s.stage}. Starting idea: ${s.state.startingIdea ? `"${s.state.startingIdea}"` : 'not yet stated'}.`;
  },
  canClose(s: Session): string | null {
    if (!s.state.startingIdea) return "Record Abi's starting idea first.";
    return null;
  },
};

// ---------------------------------------------------------------- registry
export const ENGINES = { challenge, investigation, simulation, inquiry } as const;

export function toolsFor(mode: Mode): Tool[] {
  return [...ENGINES[mode].tools(), PIN_TIMELINE, SAVE_WONDER, CLOSE_CASE];
}

export const FIRST_STAGE: Record<Mode, string> = {
  challenge: 'define',
  investigation: 'question',
  simulation: 'role',
  inquiry: 'question',
};
