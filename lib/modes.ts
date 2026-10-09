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
// Units for a Challenge: dollars + liters/day by default, or whatever the case defines.
function unitsOf(d: ChallengeData) {
  const u = d.units;
  const fmtCost = (n: number) => (u ? `${n.toLocaleString('en-US')} ${u.cost}` : money(n));
  const capLabel = u ? u.capacity : 'L/day of safe water';
  const capOf = (t: ChallengeData['toolbox'][number]) => t.capacity ?? t.capacityLitersPerDay ?? 0;
  const minCap = d.minCapacity ?? d.minLitersPerDay;
  return { u, fmtCost, capLabel, capOf, minCap };
}

export function planKey(plan: { id: string; qty: number }[], custom: { name: string; cost: number }[] = []) {
  return [...plan.map((p) => `${p.id}:${p.qty}`).sort(), ...custom.map((c) => `custom:${c.name}:${c.cost}`).sort()].join('|');
}

// ---------------------------------------------------------------- CHALLENGE
const challenge = {
  rules: `
MODE: CHALLENGE — "Make it work." Abi is the engineer. Backbone: Define → Design → Build → Test → Improve.
- You play the project team and the laws of physics. Be fair and realistic.
- Abi's screen shows the opening cards and a short list of BUILDING BLOCKS (categories only, no prices). She must ask for costs, capacities and specs; when she does, call look_up (with her plan so far) and answer briefly. Her screen has a BUDGET panel that lists every chosen item with its cost, the total, and what's left, so don't repeat the list in chat: give the price and one short line like "That leaves you 230 worker-days." Whenever her chosen items change without a price question (she drops or adds something), call update_plan so the panel stays right. Never recite the whole toolbox or offer a menu of products.
- Items marked HIDDEN exist so her own ideas can be priced fairly. Never mention, hint at or suggest them; only price one if Abi herself proposes that idea.
- Anything measured on site (water tests, how much a source yields, what's happening in homes) she must ask for. Use take_measurement and report the result in 1–3 sentences.
- Never hand her multiple-choice designs. She invents the design. Unconventional ideas are fine if physically plausible: give a fair game cost/capacity consistent with the toolbox scale.
- When she proposes a design, call submit_design. Report cost, daily capacity and any missing pieces. If it's over budget or under target, tell her the engineering result and let her fix it.
- After a valid design, say it's ready and ask if she wants to test it. Then run stress tests in order with run_stress_test, one at a time. Narrate the scenario briefly, ask what happens to her system, let her reason, then judge fairly using the test's pass rule. If her design already handles a test, say so: don't manufacture failure.
- After each stress test, once Abi has reasoned it through, call judge_test with whether her design passed.
- IMPROVE is required: after a failed test, Abi redesigns (submit_design again) and you retest that weakness. Don't fix it for her.
- If her design passes every test, run ALL the stress tests (a perfect design should prove it).
- Finish with the case's final question, get her reasoning, then close.
`.trim(),
  tools: (): Tool[] => [
    {
      name: 'look_up',
      description: "Look up the game cost, capacity and notes for items Abi asks about (only things she named or clearly described). Also pass `plan`: every item and quantity she has said she wants so far in the conversation, including this one if she wants it, so the result can show her running total and what's left.",
      input_schema: {
        type: 'object',
        properties: {
          item_ids: { type: 'array', items: { type: 'string' } },
          plan: {
            type: 'array',
            description: "Items she has chosen so far (ids and quantities). Empty if she hasn't chosen anything yet.",
            items: { type: 'object', properties: { id: { type: 'string' }, qty: { type: 'integer', minimum: 1 } }, required: ['id', 'qty'] },
          },
        },
        required: ['item_ids'],
      },
    },
    {
      name: 'update_plan',
      description: "Update the running budget on Abi's screen when her list of chosen items changes without a price question (she adds, drops or changes the quantity of something). Pass the whole plan as it now stands.",
      input_schema: {
        type: 'object',
        properties: {
          plan: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' }, qty: { type: 'integer', minimum: 1 } }, required: ['id', 'qty'] },
          },
        },
        required: ['plan'],
      },
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
              properties: { name: { type: 'string' }, cost: { type: 'number' }, liters_per_day: { type: 'number' }, capacity: { type: 'number' }, scarce: { type: 'number' }, provides: { type: 'string' } },
              required: ['name', 'cost'],
            },
          },
        },
        required: ['description', 'items'],
      },
    },
    {
      name: 'judge_test',
      description: 'Record whether her current design passed a stress test you already ran, after she has reasoned it through.',
      input_schema: {
        type: 'object',
        properties: { test_id: { type: 'string' }, passed: { type: 'boolean' }, note: { type: 'string', description: 'one short line: why' } },
        required: ['test_id', 'passed'],
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
      (() => {
        const { u, fmtCost, capLabel, minCap } = unitsOf(d);
        return `Budget: ${fmtCost(d.budget)}.${u?.scarce ? ` Scarce: ${u.scarce.limit} ${u.scarce.label} total.` : ''}${minCap ? ` Minimum target: ${minCap.toLocaleString()} ${capLabel}.` : ''}${u?.workers ? ` About ${u.workers} workers available, so ${u.workers} ${u.cost} ≈ 1 day of building.` : ''}`;
      })(),
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
  initialState: () => ({ revealed: [], design: null, testsRun: [], designCount: 0, results: [], step: 0 }),
  handle(name: string, input: any, s: Session, c: CaseDef): ToolOutcome | null {
    const d = c.data as ChallengeData;
    if (name === 'look_up') {
      const ids = arr<string>(input.item_ids);
      const found = d.toolbox.filter((t) => ids.includes(t.id));
      if (!found.length) return { result: `No matching items. Valid ids: ${d.toolbox.map((x) => x.id).join(', ')}`, isError: true };
      for (const t of found) pushUnique(s.state, 'lookedUp', t.id);
      const { u, fmtCost } = unitsOf(d);
      const plan = arr<{ id: string; qty: number }>(input.plan)
        .map((p) => ({ t: d.toolbox.find((x) => x.id === p.id), qty: Math.max(1, Number(p.qty) || 1) }))
        .filter((p) => p.t) as { t: ChallengeData['toolbox'][number]; qty: number }[];
      if (plan.length) {
        s.state.plan = plan.map((p) => ({ id: p.t.id, qty: p.qty }));
        s.state.planCustom = [];
      }
      const planCost = plan.reduce((sum, p) => sum + p.t.cost * p.qty, 0);
      const planScarce = +plan.reduce((sum, p) => sum + (p.t.scarce ?? 0) * p.qty, 0).toFixed(2);
      const budgetLines = [
        'BUDGET (her screen shows this full list in the Budget panel; in your reply just give the price and how much is left, in one short line):',
        ...(plan.length ? plan.map((p) => `- ${p.qty} × ${p.t.name}: ${fmtCost(p.t.cost * p.qty)}`) : ['- Nothing chosen yet']),
        `- Total so far: ${fmtCost(planCost)}`,
        `- Budget: ${fmtCost(d.budget)}`,
        `- Left: ${fmtCost(d.budget - planCost)}${planCost > d.budget ? ' (OVER BUDGET)' : ''}`,
        u?.scarce ? `- ${u.scarce.label}: ${planScarce} of ${u.scarce.limit} used, ${+(u.scarce.limit - planScarce).toFixed(2)} left` : '',
      ].filter(Boolean);
      return {
        result: found
          .map((t) => `${t.name}: ${unitsOf(d).fmtCost(t.cost)}${t.scarce && d.units?.scarce ? ` + ${t.scarce} ${d.units.scarce.label}` : ''}${unitsOf(d).capOf(t) ? `, about ${unitsOf(d).capOf(t).toLocaleString()} ${unitsOf(d).capLabel}` : ''}${t.max ? ` (only ${t.max} available)` : ''}. ${t.provides}${t.needs ? ` Needs: ${t.needs.map((n) => n.replace(/\|/g, ' or ').replace('existing:', '')).join(', ')}.` : ''}${t.maintenance ? ` Upkeep: ${t.maintenance}` : ''}`)
          .join('\n') + '\n\n' + budgetLines.join('\n'),
      };
    }
    if (name === 'update_plan') {
      const bad = arr<{ id: string }>(input.plan).filter((p) => !d.toolbox.find((x) => x.id === p.id));
      if (bad.length) return { result: `Unknown ids: ${bad.map((b) => b.id).join(', ')}. Valid ids: ${d.toolbox.map((x) => x.id).join(', ')}`, isError: true };
      s.state.plan = arr<{ id: string; qty: number }>(input.plan).map((p) => ({ id: p.id, qty: Math.max(1, Number(p.qty) || 1) }));
      s.state.planCustom = [];
      const { fmtCost } = unitsOf(d);
      const cost = arr<{ id: string; qty: number }>(s.state.plan).reduce((sum, p) => sum + (d.toolbox.find((x) => x.id === p.id)?.cost ?? 0) * p.qty, 0);
      return { result: `Budget panel updated. Total ${fmtCost(cost)}, ${fmtCost(d.budget - cost)} left. Her screen shows the full list.` };
    }
    if (name === 'take_measurement') {
      const m = d.measurements.find((x) => x.id === input.measurement_id);
      if (!m) return { result: `No measurement "${input.measurement_id}". Valid ids: ${d.measurements.map((x) => x.id).join(', ')}`, isError: true };
      pushUnique(s.state, 'revealed', m.id);
      if (m.image) s.state.showImages = [...arr(s.state.showImages), m.image];
      if (s.stage === 'define') s.stage = 'design';
      return { result: `${m.label}: ${m.result}${m.conditions ? ` (${m.conditions})` : ''}` };
    }
    if (name === 'submit_design') {
      const { u, fmtCost, capLabel, capOf, minCap } = unitsOf(d);
      const lines: string[] = [];
      let cost = 0;
      let capacity = 0;
      let scarce = 0;
      const chosen = new Map<string, number>();
      for (const it of arr<{ id: string; qty: number }>(input.items)) {
        const t = d.toolbox.find((x) => x.id === it.id);
        if (!t) return { result: `Unknown toolbox id "${it.id}". Valid ids: ${d.toolbox.map((x) => x.id).join(', ')}`, isError: true };
        chosen.set(t.id, (chosen.get(t.id) ?? 0) + Math.max(1, it.qty || 1));
      }
      const missing: string[] = [];
      for (const [id, qty] of chosen) {
        const t = d.toolbox.find((x) => x.id === id)!;
        if (t.max !== undefined && qty > t.max) missing.push(`only ${t.max} × ${t.name} available, design uses ${qty}`);
        cost += t.cost * qty;
        scarce += (t.scarce ?? 0) * qty;
        // Each need is a toolbox id, or alternatives written "a|b", or "existing:<thing>" (already available).
        const needsMet = (t.needs ?? []).every((n) => n.split('|').some((alt) => alt.startsWith('existing:') || chosen.has(alt)));
        let usable = Math.min(qty, t.max ?? qty);
        if (t.limitedBy?.length) {
          const cap = t.limitedBy.reduce((sum, lid) => {
            const lt = d.toolbox.find((x) => x.id === lid);
            return sum + Math.min(chosen.get(lid) ?? 0, lt?.max ?? Infinity);
          }, 0);
          if (cap < usable) missing.push(`only ${cap} of ${qty} × ${t.name} can be used (needs one ${t.limitedBy.join(' or ')} each)`);
          usable = Math.min(usable, cap);
        }
        if (capOf(t) && needsMet) capacity += capOf(t) * usable;
        if (!needsMet) missing.push(`${t.name} won't work without: ${(t.needs ?? []).map((n) => n.replace(/\|/g, ' or ')).join(' and ')}`);
        lines.push(`${qty} × ${t.name} = ${fmtCost(t.cost * qty)}${t.scarce && u?.scarce ? ` + ${+(t.scarce * qty).toFixed(2)} ${u.scarce.label}` : ''}`);
      }
      for (const ci of arr<{ name: string; cost: number; liters_per_day?: number; capacity?: number; scarce?: number }>(input.custom_items)) {
        cost += ci.cost;
        capacity += ci.capacity ?? ci.liters_per_day ?? 0;
        scarce += ci.scarce ?? 0;
        lines.push(`custom: ${ci.name} = ${fmtCost(ci.cost)}${(ci.capacity ?? ci.liters_per_day) ? `, ${ci.capacity ?? ci.liters_per_day} ${capLabel}` : ''}`);
      }
      scarce = +scarce.toFixed(2);
      const overBudget = cost > d.budget;
      const overScarce = u?.scarce ? scarce > u.scarce.limit : false;
      const underTarget = minCap ? capacity < minCap : false;
      const valid = !overBudget && !overScarce && !underTarget && missing.length === 0;
      const days = u?.workers ? Math.ceil(cost / u.workers) : 0;
      const line = [fmtCost(cost), u?.scarce ? `${scarce} ${u.scarce.label}` : '', `${capacity.toLocaleString()} ${capLabel}`, days ? `~${days} days to build` : ''].filter(Boolean).join(' · ');
      const customs = arr<{ name: string; cost: number; capacity?: number; liters_per_day?: number; scarce?: number }>(input.custom_items).map((ci) => ({ name: ci.name, cost: ci.cost, scarce: ci.scarce ?? 0 }));
      s.state.plan = [...chosen].map(([id, qty]) => ({ id, qty }));
      s.state.planCustom = customs;
      const key = planKey(s.state.plan as { id: string; qty: number }[], customs);
      s.state.design = { description: input.description, lines, cost, liters: capacity, capacity, scarce, days, line, valid, key, target: minCap ?? 0, missing };
      s.state.designCount = (Number(s.state.designCount) || 0) + 1;
      s.state.step = (Number(s.state.step) || 0) + 1;
      s.state.lastDesignStep = s.state.step;
      s.stage = valid ? (arr(s.state.testsRun).length ? 'improve' : 'build') : 'design';
      return {
        result: [
          `Design: ${input.description}`,
          ...lines,
          `Total: ${fmtCost(cost)} of ${fmtCost(d.budget)} budget${overBudget ? ` — OVER by ${fmtCost(cost - d.budget)}` : ''}.`,
          u?.scarce ? `${u.scarce.label}: ${scarce} of ${u.scarce.limit}${overScarce ? ' — NOT ENOUGH' : ''}.` : '',
          days ? `Build time: about ${days} days with ${u?.workers} workers.` : '',
          `Capacity: about ${capacity.toLocaleString()} ${capLabel}${minCap ? ` (target ${minCap.toLocaleString()})${underTarget ? ' — BELOW TARGET' : ''}` : ''}.`,
          missing.length ? `Missing pieces: ${missing.join('; ')}` : '',
          valid ? 'Design is valid and ready to test.' : 'Design is not valid yet. Tell Abi the engineering result; let her fix it.',
          'Note: these numbers are a simple game estimate. The stress tests check everything else.',
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }
    if (name === 'judge_test') {
      if (!arr<string>(s.state.testsRun).includes(String(input.test_id))) return { result: 'Run that stress test first.', isError: true };
      s.state.step = (Number(s.state.step) || 0) + 1;
      const results = arr<{ test: string; passed: boolean; note: string; step: number }>(s.state.results);
      results.push({ test: String(input.test_id), passed: Boolean(input.passed), note: String(input.note ?? ''), step: Number(s.state.step) });
      s.state.results = results;
      if (!input.passed) {
        s.state.lastFailStep = s.state.step;
        s.stage = 'improve';
        return { result: 'Recorded: failed. Let Abi figure out what to change; then submit_design and retest.' };
      }
      return { result: 'Recorded: passed.' };
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
    const design = s.state.design as { description: string; line?: string; valid: boolean } | null;
    return `Stage: ${s.stage}. Measurements taken: ${arr<string>(s.state.revealed).join(', ') || 'none'}. ${
      design ? `Current design: "${design.description}" (${design.line ?? ''}), ${design.valid ? 'valid' : 'not valid'}.` : 'No design yet.'
    } Stress tests run: ${arr<string>(s.state.testsRun).join(', ') || 'none'} of ${d.stressTests.length}. Results: ${arr<{ test: string; passed: boolean }>(s.state.results).map((r) => `${r.test} ${r.passed ? 'passed' : 'FAILED'}`).join(', ') || 'none yet'}. Redesigns: ${Math.max(0, (Number(s.state.designCount) || 0) - 1)}.`;
  },
  canClose(s: Session, c: CaseDef): string | null {
    const d = c.data as ChallengeData;
    const design = s.state.design as { valid?: boolean } | null;
    if (!design?.valid) return 'There is no valid design yet.';
    const need = Math.min(3, d.stressTests.length);
    if (arr(s.state.testsRun).length < need) return `Run at least ${need} stress tests first (run so far: ${arr(s.state.testsRun).length}).`;
    const results = arr<{ passed: boolean }>(s.state.results);
    if (results.length < need) return `Judge the stress tests you ran (judge_test). Judged so far: ${results.length}.`;
    const lastFail = Number(s.state.lastFailStep) || 0;
    if (lastFail && (Number(s.state.lastDesignStep) || 0) < lastFail) return 'Her design failed a test and she has not improved it yet. Let her redesign (submit_design), then retest.';
    if (!lastFail && arr(s.state.testsRun).length < d.stressTests.length) return 'Her design has passed everything so far. Run all the stress tests before closing.';
    return null;
  },
};

// ---------------------------------------------------------------- INVESTIGATION
const investigation = {
  rules: `
MODE: INVESTIGATION — "Figure it out." Abi is the investigator. Backbone: Question → Evidence → Hypothesis → Conclusion.
- You play the lab, the archive and the witnesses.
- Abi decides what to look at. Whenever evidence reaches her, whether she inspects it, reads it, or a witness or character tells her, call examine for that item FIRST and base your answer on its result. Report it in 1–3 sentences (in character if a witness). If she asks for something the case doesn't have, give a short plausible answer that doesn't change the case.
- Never list what she should investigate. No multiple choice.
- Give each evidence result as-is. Don't interpret it, compare it to other evidence, or hint at what it means unless she asks what you think, and even then turn it back to her.
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
      description: 'Reveal an evidence item to Abi, whether she inspects it or a witness testifies to it. Returns the actual evidence from the case data. Call before describing it.',
      input_schema: { type: 'object', properties: { evidence_id: { type: 'string' }, via: { type: 'string', description: 'optional: who told her, e.g. "testimony of John Smith"' } }, required: ['evidence_id'] },
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
      if (e.image) s.state.showImages = [...arr(s.state.showImages), e.image];
      return { result: `${e.label}: ${e.result}${e.image ? '\n(A picture of this is now shown on her screen above your message; don\'t describe it in detail.)' : ''}` };
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
    if (arr(s.state.examined).length < 3) return `Only ${arr(s.state.examined).length} evidence items are recorded. If Abi already heard or saw more evidence (including witness testimony), call examine for each of those items now, then close.`;
    if (!arr(s.state.theories).length) return 'Abi has not stated a theory yet (record_theory).';
    return null;
  },
};

// ---------------------------------------------------------------- SIMULATION

// A stat as a word from its scale (0–10 mapped evenly), or the number itself.
export function statWord(st: { scale?: string[]; kind?: 'count' }, v: number): string {
  if (st.kind === 'count' || !st.scale?.length) return String(v);
  const n = st.scale.length;
  return st.scale[Math.max(0, Math.min(n - 1, Math.round((v * (n - 1)) / 10)))];
}
const statsLine = (d: SimulationData, stats: Record<string, number>) => d.stats.map((x) => `${x.label}: ${statWord(x, stats[x.id])}`).join(' · ');

// Apply stat changes, then fire any threshold consequences (each fires once; knock-ons can chain).
function applyStats(d: SimulationData, s: Session, effects: Record<string, number>): { changes: string[]; triggered: string[] } {
  const stats = (s.state.stats ?? {}) as Record<string, number>;
  // Arrows show everything that changed this turn (a choice plus any event it led to).
  const delta: Record<string, number> = s.state.deltaFresh ? {} : { ...((s.state.lastDelta ?? {}) as Record<string, number>) };
  s.state.deltaFresh = false;
  const changes: string[] = [];
  const triggered: string[] = [];
  const apply = (eff: Record<string, number>) => {
    for (const [k, v] of Object.entries(eff)) {
      if (!(k in stats) || !v) continue;
      const st = d.stats.find((x) => x.id === k);
      const before = stats[k];
      stats[k] = st?.kind === 'count' ? Math.max(0, before + v) : Math.max(0, Math.min(10, before + v));
      const real = stats[k] - before;
      if (!real) continue;
      delta[k] = (delta[k] ?? 0) + real;
      changes.push(`${st?.label ?? k} ${real > 0 ? '↑' : '↓'}${st?.kind === 'count' ? Math.abs(real) : ''}${st && st.kind !== 'count' ? ` (now ${statWord(st, stats[k])})` : ''}`);
    }
  };
  apply(effects);
  const fired = arr<string>(s.state.triggered);
  for (let round = 0; round < 3; round++) {
    let any = false;
    for (const t of d.triggers ?? []) {
      if (fired.includes(t.id)) continue;
      const v = stats[t.stat];
      const hit = (t.below !== undefined && v <= t.below) || (t.above !== undefined && v >= t.above);
      if (!hit) continue;
      fired.push(t.id);
      triggered.push(t.event);
      if (t.effects) apply(t.effects);
      any = true;
    }
    if (!any) break;
  }
  s.state.stats = stats;
  s.state.triggered = fired;
  s.state.lastDelta = delta;
  return { changes, triggered };
}
const simulation = {
  rules: `
MODE: SIMULATION — "Live the history." Abi is a participant inside a real historical world. Backbone: Role → Situation → Decision → Consequence → Adapt.
- You are the world: narrator, the people she meets, the setting. Not a coach.
- Immersion first. Small, vivid, true details (smells, heat, bugs, food, the work) in a sentence or two, not paragraphs.
- Real people talk in character, briefly, with personality. A little humor is welcome when it's historically honest.
- Abi only knows what someone in her role could know. No modern hindsight from characters. If Abi uses what she learned in class, characters react as people of their time would.
- History is mechanisms: when it matters, let her see WHY things happen (incentives, orders from investors, disease, weather, relationships).
- MULTIPLE CHOICE IS REQUIRED HERE (this overrides any general rule against options). At every decision point, call present_decision with a short title and 3–4 options YOU write, adapted to her colony's story so far (build on her earlier strategy, e.g. a settlement she founded, a policy she set). Each option has a 2–6 word label and a one-or-two-sentence detail with its real tradeoff. Use the case's options as anchors and set base_option_id when an option matches one. The options appear as buttons; don't repeat them in your text.
- When she picks, call make_choice with the base option id (or custom_choice for a new idea) and choice_label = her choice as shown.
- EACH TURN after she chooses, in this order, as short paragraphs:
  1. "**You choose B: <short name>**" then the consequence in 3–5 vivid sentences, weaving in real history (people, places, events) where it fits.
  2. A status card, exactly in this shape (one line each, plain words). The first five lines use the tool's numbers and status words; the last four come from her story:
     **Your Colony**
     👥 Colonists: 104 → 91
     🌽 Food: Low
     ❤️ Health: Fair
     🤝 Powhatan relations: Tense
     💰 Investors: Waiting
     💧 Water: Poor (worse)
     🌾 Food production: Started (better)
     🏠 Settlement: Fort built (same)
     🪙 Profit: None (same)
     End each of the four story lines with (better), (worse) or (same) compared with the last card. Abi's side panel turns these into arrows.
  3. If a real event happens next, call advance_time and give it its own bold emoji heading (e.g. "**⛵ The First Supply Arrives**") and 2–4 sentences, then an updated status card if numbers changed.
  4. Then the next decision (present_decision).
- TOOLS FIRST, THEN WRITE: on a turn where she chooses, call make_choice, then advance_time if an event is due, then present_decision for the next one, and only after all of those results are back, write the whole turn (steps 1–4) as ONE message. Never send just a fragment.
- Never mention buttons, the screen, tools or "options shown". Just ask the decision's question in the story.
- Explain hard words the moment you use them, in a few words (e.g. "dysentery, a stomach disease that causes severe diarrhea").
- Real historical events happen on schedule: call advance_time to bring the next fixed event in when the story reaches it.
- Her choices have knock-on effects: when a tool result says CONSEQUENCE TRIGGERED, that event happens now. Narrate it briefly and let her respond. These are how her earlier decisions shape what comes later.
- Her version of history may differ from what really happened. The setting and facts stay accurate.
- At the end, run the case's debrief exactly as described in its notes.
`.trim(),
  tools: (): Tool[] => [
    {
      name: 'present_decision',
      description: "Start a decision point and put 3–4 choice buttons on Abi's screen. Write the options yourself, adapted to HER colony's story so far (her earlier strategy, places, people, problems), using the case's options for this decision as anchors. For each option give base_option_id = the case option it is closest to (so its effects come from the case), or leave it out for a genuinely new idea (then you'll give small fair effects when she picks it). Keep real tradeoffs; no option should be obviously right.",
      input_schema: {
        type: 'object',
        properties: {
          decision_id: { type: 'string' },
          title: { type: 'string', description: 'short decision title, e.g. "Where will you build?" or "Who works?"' },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'the choice in 2–6 words, e.g. "River peninsula" or "Back Smith"' },
                detail: { type: 'string', description: "one or two short sentences: what it means and its tradeoff, e.g. \"Ships can pull close and it's easier to defend. But the land is marshy and the water may be a problem.\"" },
                base_option_id: { type: 'string' },
              },
              required: ['label', 'detail'],
            },
          },
        },
        required: ['decision_id'],
      },
    },
    {
      name: 'make_choice',
      description: "Apply Abi's choice at a decision point. Use option_id for one of the case's options, or custom_choice for her own idea (then give small, fair stat effects).",
      input_schema: {
        type: 'object',
        properties: {
          decision_id: { type: 'string' },
          option_id: { type: 'string', description: 'the case option id (use the base_option_id of the button she picked)' },
          choice_label: { type: 'string', description: 'what she actually chose, in the words shown to her' },
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
      `Stats shown on her screen: ${d.stats.map((x) => (x.kind === 'count' ? `${x.label} (a number)` : `${x.label} (0–10)`)).join(', ')}`,
      d.sequence?.length ? `ORDER OF PLAY (decisions and real events, interleaved): ${d.sequence.join(' → ')}` : '',
      d.triggers?.length ? `Consequences that fire automatically when stats cross a line (don't reveal ahead of time): ${d.triggers.map((t) => `${t.stat} ${t.below !== undefined ? `≤ ${t.below}` : `≥ ${t.above}`}`).join(', ')}` : '',
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
    const first = (d.sequence ?? [])[0];
    const pendingDecision = first && d.decisions.some((x) => x.id === first) ? first : null;
    return { stats: Object.fromEntries(d.stats.map((x) => [x.id, x.start])), choices: [], events: [], pendingDecision };
  },
  handle(name: string, input: any, s: Session, c: CaseDef): ToolOutcome | null {
    const d = c.data as SimulationData;
    const stats = (s.state.stats ?? {}) as Record<string, number>;
    if (name === 'present_decision') {
      const dp = d.decisions.find((x) => x.id === input.decision_id);
      if (!dp) return { result: `Unknown decision. Valid ids: ${d.decisions.map((x) => x.id).join(', ')}`, isError: true };
      if (arr<{ decision: string }>(s.state.choices).some((ch) => ch.decision === dp.id)) return { result: 'That decision was already made.', isError: true };
      s.state.pendingDecision = dp.id;
      const letters = 'ABCD';
      const given = arr<{ label: string; detail?: string; base_option_id?: string }>(input.options).filter((o) => o && o.label).slice(0, 4);
      const opts = (given.length >= 2 ? given : dp.options.map((o) => ({ label: o.label, detail: '', base_option_id: o.id }))).map((o, i) => ({
        letter: letters[i],
        label: String(o.label),
        detail: o.detail ? String(o.detail) : '',
        base: o.base_option_id && dp.options.some((x) => x.id === o.base_option_id) ? o.base_option_id : null,
      }));
      s.state.pendingOptions = opts;
      s.state.pendingTitle = input.title ? String(input.title) : '';
      s.state.decisionNumber = arr(s.state.choices).length + 1;
      return {
        result: `Decision ${arr(s.state.choices).length + 1} (${dp.id}, ${dp.when}) is on her screen as buttons:\n${opts.map((o) => `${o.letter}. ${o.label}: ${o.detail}${o.base ? ` [effects of case option ${o.base}]` : ' [new idea: you set small fair effects]'}`).join('\n')}\nCase anchor situation: ${dp.situation}\nCase anchor options: ${dp.options.map((o) => `${o.id} = ${o.label}`).join(' | ')}\nNow write your full message for this turn. If she just chose, it starts with "**You choose …**", the consequence, the Your Colony card and any event (see the turn order). It ends with a bold heading "**Decision ${arr(s.state.choices).length + 1}: ${input.title ?? '…'}**", the situation in her colony's own story (2–4 short sentences), and one clear question. Don't list the choices in your text and don't mention buttons or the screen.`,
      };
    }
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
        label = input.choice_label ? String(input.choice_label) : o.label;
      } else if (input.custom_choice) {
        for (const [k, v] of Object.entries((input.custom_effects ?? {}) as Record<string, number>)) {
          if (!(k in stats)) continue;
          const isCount = d.stats.find((x) => x.id === k)?.kind === 'count';
          effects[k] = isCount ? Math.max(-20, Math.min(20, Number(v) || 0)) : Math.max(-2, Math.min(2, Number(v) || 0));
        }
        label = String(input.custom_choice);
        consequence = 'Abi chose her own path. Narrate a fair, historically plausible consequence.';
      } else return { result: 'Give option_id or custom_choice.', isError: true };
      const { changes, triggered } = applyStats(d, s, effects);
      s.state.choices = [...arr(s.state.choices), { decision: dp.id, option: input.option_id ? String(input.option_id) : 'custom', choice: label }];
      s.state.lastChoice = label;
      if (s.state.pendingDecision === dp.id) {
        s.state.pendingDecision = null;
        s.state.pendingOptions = null;
        s.state.pendingTitle = '';
      }
      s.stage = 'decision';
      const now = (s.state.stats ?? {}) as Record<string, number>;
      return {
        result: [
          `Choice: ${label}`,
          `Consequence: ${consequence}`,
          `Stat changes: ${changes.join(', ') || 'none'}`,
          ...triggered.map((t) => `CONSEQUENCE TRIGGERED: ${t}`),
          `Status now: ${statsLine(d, now)}`,
        ].join('\n'),
      };
    }
    if (name === 'advance_time') {
      const e = d.fixedEvents.find((x) => x.id === input.event_id);
      if (!e) return { result: `Unknown event. Valid ids: ${d.fixedEvents.map((x) => x.id).join(', ')}`, isError: true };
      if (arr<string>(s.state.events).includes(e.id)) return { result: 'That event already happened.', isError: true };
      pushUnique(s.state, 'events', e.id);
      const made = arr<{ decision: string; option?: string }>(s.state.choices).map((ch) => `${ch.decision}:${ch.option ?? ''}`);
      const eff: Record<string, number> = { ...(e.effects ?? {}) };
      const notes: string[] = [];
      for (const m of e.modifiers ?? []) {
        if (!made.includes(m.ifChoice)) continue;
        for (const [k, v] of Object.entries(m.effects)) eff[k] = (eff[k] ?? 0) + v;
        if (m.note) notes.push(m.note);
      }
      const { changes, triggered } = applyStats(d, s, eff);
      const now = (s.state.stats ?? {}) as Record<string, number>;
      return {
        result: [
          `${e.when}: ${e.event}`,
          notes.length ? `How her earlier choices changed this: ${notes.join(' ')}` : '',
          changes.length ? `Stat changes: ${changes.join(', ')}` : '',
          ...triggered.map((t) => `CONSEQUENCE TRIGGERED: ${t}`),
          `Status now: ${statsLine(d, now)}`,
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }
    return null;
  },
  status(s: Session, c: CaseDef) {
    const d = c.data as SimulationData;
    const stats = (s.state.stats ?? {}) as Record<string, number>;
    const doneIds = [...arr<{ decision: string }>(s.state.choices).map((ch) => ch.decision), ...arr<string>(s.state.events)];
    const nextUp = (d.sequence ?? []).find((id) => !doneIds.includes(id));
    const nextKind = nextUp ? (d.decisions.some((x) => x.id === nextUp) ? 'decision (call present_decision)' : 'real event (call advance_time)') : '';
    const pending = s.state.pendingDecision ? `Decision on screen now, waiting for her choice: ${s.state.pendingDecision}. ` : '';
    return `${pending}${nextUp ? `NEXT IN ORDER OF PLAY: ${nextUp}, a ${nextKind}. ` : ''}Status: ${statsLine(d, stats)}. Consequences triggered: ${arr<string>(s.state.triggered).join(', ') || 'none'}. Decisions made: ${arr<{ decision: string; choice: string }>(s.state.choices).map((c) => `${c.decision}: ${c.choice}`).join('; ') || 'none'}. Events so far: ${arr<string>(s.state.events).join(', ') || 'none'}. Remaining decisions: ${d.decisions.filter((dp) => !arr<{ decision: string }>(s.state.choices).some((c) => c.decision === dp.id)).map((dp) => dp.id).join(', ') || 'none'}.`;
  },
  canClose(s: Session, c: CaseDef): string | null {
    const d = c.data as SimulationData;
    const need = Math.ceil(d.decisions.length / 2);
    if (arr(s.state.choices).length < need) return `Make at least ${need} decisions first.`;
    const made = arr<{ decision: string }>(s.state.choices).map((ch) => ch.decision);
    const missing = (d.requiredDecisions ?? []).filter((id) => !made.includes(id));
    if (missing.length) return `These decisions still have to happen: ${missing.join(', ')}.`;
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
