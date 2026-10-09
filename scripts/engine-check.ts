// Offline check of the engine's rules, using a scripted fake model (no API key needed).
import { startCaseSession, getSession } from '../lib/sessions';
import { runTurn } from '../lib/engine';
import { caseFor, getCase } from '../lib/cases';

function fakeClient(script: any[][]) {
  let i = 0;
  return { messages: { create: async () => {
    const blocks = script[i++] ?? [{ type: 'text', text: 'ok' }];
    return { content: blocks, stop_reason: blocks.some((b: any) => b.type === 'tool_use') ? 'tool_use' : 'end_turn' };
  } } } as any;
}
const tu = (name: string, input: any) => ({ type: 'tool_use', id: 'tu_' + Math.random().toString(36).slice(2), name, input });
const tx = (text: string) => ({ type: 'text', text });
const close = (extra = {}) => tu('close_case', { abi_final_words: 'x', hook: 'h', quote: 'q', quote_label: 'l', visual: { kind: 'list', title: 't', items: ['a'] }, found_title: 'f', found: ['a'], follow_ups: ['a?', 'b?', 'c?'], parent_what_happened: 'p', ...extra });
async function step(s: any, tool: any) {
  await runTurn(s, 'go', fakeClient([[tool], [tx('.')]]));
  const fresh = (await getSession(s.id))!;
  const last = [...fresh.api].reverse().find((m: any) => m.role === 'user' && Array.isArray(m.content)) as any;
  Object.assign(s, fresh);
  return String(last.content[0].content).split('\n')[0];
}
let fails = 0;
function expect(label: string, got: string, contains: string) {
  const ok = got.includes(contains);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  →  ${got.slice(0, 110)}`);
}

async function main() {
  // --- Challenge: improve is required after a failure
  const ch: any = await startCaseSession('001', true);
  const design = (n: number) => tu('submit_design', { description: 'design ' + n, items: [{ id: 'repair_borehole', qty: 1 }, { id: 'solar_pump', qty: 1 }, { id: 'storage_tank', qty: 1 }, { id: 'tap_stand', qty: 6 }, { id: 'pipe_km', qty: 3 }] });
  await step(ch, tu('look_up', { item_ids: ['solar_pump'], plan: [{ id: 'repair_borehole', qty: 1 }, { id: 'solar_pump', qty: 1 }] }));
  const lk = [...ch.api].reverse().find((m: any) => m.role === 'user' && Array.isArray(m.content)) as any;
  expect('challenge: cost lookup shows budget left', String(lk.content[0].content), '- Left: $22,000');
  expect('challenge: design priced', await step(ch, design(1)), 'Design: design 1');
  for (const t of ['rainy_season', 'access', 'recontamination']) await step(ch, tu('run_stress_test', { test_id: t }));
  expect('challenge: must judge tests', await step(ch, close()), 'Judge the stress tests');
  await step(ch, tu('judge_test', { test_id: 'rainy_season', passed: true }));
  await step(ch, tu('judge_test', { test_id: 'access', passed: true }));
  await step(ch, tu('judge_test', { test_id: 'recontamination', passed: false, note: 'open buckets' }));
  expect('challenge: must improve after failure', await step(ch, close()), 'has not improved it yet');
  await step(ch, design(2));
  expect('challenge: closes after redesign', await step(ch, close()), 'Case closed');

  // --- Challenge: perfect design must run all tests
  const ch2: any = await startCaseSession('001', true);
  await step(ch2, design(1));
  for (const t of ['rainy_season', 'access', 'recontamination']) { await step(ch2, tu('run_stress_test', { test_id: t })); await step(ch2, tu('judge_test', { test_id: t, passed: true })); }
  expect('challenge: all-pass needs all tests', await step(ch2, close()), 'Run all the stress tests');

  // --- Investigation: blocker tells the guide to record testimony
  const inv: any = await startCaseSession('003', true);
  await step(inv, tu('examine', { evidence_id: 'pamphlet', via: 'testimony of Robert Johnson' }));
  expect('investigation: exhibit image shown in chat', JSON.stringify(inv.display.filter((m: any) => m.image).map((m: any) => m.image.alt)), 'Nova Britannia');
  await step(inv, tu('record_theory', { theory: 'The Company lied', supporting: ['pamphlet'] }));
  expect('investigation: self-healing blocker', await step(inv, close()), 'call examine for each');
  await step(inv, tu('examine', { evidence_id: 'percy' }));
  await step(inv, tu('examine', { evidence_id: 'death_count' }));
  expect('investigation: closes', await step(inv, close()), 'Case closed');

  // --- Simulation (Jamestown): people count, choice-dependent events, triggers, required decision
  const sim: any = await startCaseSession('005', true);
  expect('jamestown: first decision buttons ready at start', JSON.stringify((await import('../lib/view')).toView(sim).decision), '"when":"May 1607"');
  await step(sim, tu('present_decision', { decision_id: 'site', options: [{ label: 'The island the Company likes', base_option_id: 'island' }, { label: 'Higher ground with springs', base_option_id: 'high_ground' }, { label: 'Ask the sailors which spot floods', }] }));
  expect('jamestown: adapted options on screen', JSON.stringify((await import('../lib/view')).toView(sim).decision), 'Ask the sailors which spot floods');
  expect('jamestown: status in words', JSON.stringify((await import('../lib/view')).toView(sim).stats), '"word":"Fair"');
  await step(sim, tu('make_choice', { decision_id: 'site', option_id: 'high_ground' }));
  expect('jamestown: buttons clear after choosing', String((await import('../lib/view')).toView(sim).decision), 'undefined');
  await step(sim, tu('advance_time', { event_id: 'attack' }));
  await step(sim, tu('make_choice', { decision_id: 'water', option_id: 'well' }));
  await step(sim, tu('advance_time', { event_id: 'sickness' }));
  expect('jamestown: earlier choices soften the sickness', String(sim.state.stats.people), '82');
  expect('jamestown: arrows recorded', JSON.stringify(sim.state.lastDelta), '"people":-20');
  await runTurn(sim, 'go', fakeClient([[tu('make_choice', { decision_id: 'relations', option_id: 'force' })], [tx('.')]]));
  await runTurn(sim, 'go', fakeClient([[tu('make_choice', { decision_id: 'food_labor', option_id: 'trade' })], [tx('.')]]));
  {
    const r = await runTurn(sim, 'A. Envoys', fakeClient([[tu('make_choice', { decision_id: 'supply_ship', option_id: (sim.caseSnapshot!.data as any).decisions.find((x: any) => x.id === 'supply_ship').options[0].id })], [tx('Those are on your screen now. What will you do about the water?')], [tx('**You choose A: Envoys**\nThey trade.\n\n**Your Colony**\n❤️ Colonists: 90\n🍞 Food: Low')]]));
    expect('jamestown: fragment reply gets repaired', r.reply, 'Your Colony');
    expect('jamestown: fragment not shown', String(!r.reply.includes('on your screen')), 'true');
  }
  const after = (await getSession(sim.id))!;
  expect('jamestown: low relations triggers ambush', JSON.stringify(after.api).includes('CONSEQUENCE TRIGGERED: Warriors ambush') ? 'ambush' : 'none', 'ambush');
  Object.assign(sim, after);
  for (const dcs of ['build_first:fort', 'supply_ship:survival']) { const [a, b] = dcs.split(':'); await step(sim, tu('make_choice', { decision_id: a, option_id: b })); }
  expect('jamestown: must reach the Starving Time', await step(sim, close()), 'still have to happen: starving');

  // --- Build for Survival: worker-days, nails, people, limits
  const sh: any = await startCaseSession('004', true);
  expect('shelter: pegged daub thatch for 100', await step(sh, tu('submit_design', { description: 'pegged', items: [{ id: 'frame_pegged', qty: 20 }, { id: 'wall_daub', qty: 20 }, { id: 'roof_thatch', qty: 20 }] })), 'Design: pegged');
  expect('shelter: 100 is now below the 105 target', JSON.stringify(sh.state.design), '"valid":false');
  await step(sh, tu('submit_design', { description: 'canvas', items: [{ id: 'frame_nailed', qty: 31 }, { id: 'wall_wattle', qty: 31 }, { id: 'roof_canvas', qty: 31 }] }));
  expect('shelter: canvas limit + nails limit', JSON.stringify(sh.state.design), '"valid":false');
  expect('shelter: canvas limited capacity', String(sh.state.design.capacity), '40');

  // --- Version lock: session keeps its snapshot even if the case file changes
  const lock: any = await startCaseSession('002', true);
  const live = getCase('002')!;
  const original = live.opening.intro;
  live.opening.intro = 'CHANGED AFTER START';
  const locked = caseFor((await getSession(lock.id))!)!;
  expect('version lock: session keeps its version', locked.opening.intro, original.slice(0, 20));
  live.opening.intro = original;

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
}
main();
