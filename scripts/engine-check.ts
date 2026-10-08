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
  await step(inv, tu('record_theory', { theory: 'The Company lied', supporting: ['pamphlet'] }));
  expect('investigation: self-healing blocker', await step(inv, close()), 'call examine for each');
  await step(inv, tu('examine', { evidence_id: 'percy' }));
  await step(inv, tu('examine', { evidence_id: 'death_count' }));
  expect('investigation: closes', await step(inv, close()), 'Case closed');

  // --- Simulation: low relations triggers an ambush; events move stats
  const sim: any = await startCaseSession('005', true);
  expect('simulation: event changes stats', await step(sim, tu('advance_time', { event_id: 'attack' })), 'Late May 1607');
  await step(sim, tu('make_choice', { decision_id: 'site', option_id: 'near_town' }));
  await runTurn(sim, 'go', fakeClient([[tu('make_choice', { decision_id: 'food', option_id: 'take' })], [tx('.')]]));
  const s3 = (await getSession(sim.id))!;
  const res = JSON.stringify(s3.api);
  expect('simulation: consequence triggered', res.includes('CONSEQUENCE TRIGGERED: Warriors ambush') ? 'ambush fired' : 'no trigger', 'ambush fired');

  // --- Build for Survival: worker-days, nails, people, limits
  const sh: any = await startCaseSession('004', true);
  expect('shelter: pegged daub thatch for 100', await step(sh, tu('submit_design', { description: 'pegged', items: [{ id: 'frame_pegged', qty: 20 }, { id: 'wall_daub', qty: 20 }, { id: 'roof_thatch', qty: 20 }] })), 'Design: pegged');
  expect('shelter: valid + numbers', JSON.stringify(sh.state.design), '"line":"360 worker-days · 0 kegs of nails · 100 people sheltered · ~12 days to build"');
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
