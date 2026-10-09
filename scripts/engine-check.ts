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
const close = (extra = {}) => tu('close_case', { abi_final_words: 'x', in_your_words: 'The fields failed because of the crop, the method and the ground.', hook: 'h', quote: 'q', quote_label: 'l', visual: { kind: 'list', title: 't', items: ['a'] }, found_title: 'f', found: ['a'], follow_ups: ['a?', 'b?', 'c?'], parent_what_happened: 'p', ...extra });
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
  const design = (n: number) => tu('submit_design', { description: 'design ' + n, items: [{ id: 'repair_borehole', qty: 1 }, { id: 'solar_pump', qty: 1 }, { id: 'storage_tank', qty: 1 }, { id: 'tap_stand', qty: 6 }, { id: 'pipe_km', qty: n > 1 ? 2 : 3 }, ...(n > 1 ? [{ id: 'safe_containers', qty: 1 }, { id: 'maintenance_fund', qty: 1 }, { id: 'hand_pump', qty: 1 }] : [])] });
  await step(ch, tu('look_up', { item_ids: ['solar_pump'], plan: [{ id: 'repair_borehole', qty: 1 }, { id: 'solar_pump', qty: 1 }] }));
  const lk = [...ch.api].reverse().find((m: any) => m.role === 'user' && Array.isArray(m.content)) as any;
  expect('challenge: cost lookup shows budget left', String(lk.content[0].content), '- Left: $22,000');
  expect('challenge: design priced', await step(ch, design(1)), 'Design: design 1');
  for (const t of ['rainy_season', 'access', 'recontamination']) await step(ch, tu('run_stress_test', { test_id: t }));
  expect('challenge: must judge tests', await step(ch, close()), "Testing isn't finished");
  await step(ch, tu('judge_test', { test_id: 'rainy_season', passed: true }));
  const keepGoing = await (async () => { await step(ch, tu('judge_test', { test_id: 'access', passed: true })); const m = [...ch.api].reverse().find((x: any) => x.role === 'user' && Array.isArray(x.content)) as any; return String(m.content[0].content); })();
  expect('challenge: a pass reports just that test', keepGoing, 'THIS test only');
  expect('challenge: next-test button on screen', JSON.stringify((await import('../lib/view')).toView(ch).nextTest), '"name":"Recontamination"');
  await step(ch, tu('judge_test', { test_id: 'recontamination', passed: false, note: 'open buckets' }));
  expect('challenge: must improve after failure', await step(ch, close()), 'has not improved it yet');
  await step(ch, design(2));
  expect('challenge: redesign alone is not enough', await step(ch, close()), '"recontamination" hasn\'t passed');
  for (const [t, ok] of [['recontamination', true], ['mosquito', true], ['breakdown', true]] as const) { await step(ch, tu('run_stress_test', { test_id: t })); await step(ch, tu('judge_test', { test_id: t, passed: ok })); }
  expect('challenge: closes once every test passes', await step(ch, close()), 'Case closed');

  // --- Challenge: necessary pieces are checked from the real design
  const ch3: any = await startCaseSession('001', true);
  expect('challenge: untreated river water does not count', await (async () => {
    await step(ch3, tu('submit_design', { description: 'river pump to taps', items: [{ id: 'river_intake', qty: 1 }, { id: 'storage_tank', qty: 1 }, { id: 'tap_stand', qty: 6 }, { id: 'pipe_km', qty: 3 }] }));
    return JSON.stringify(ch3.state.design);
  })(), '"capacity":0');
  expect('challenge: custom raw water must say if it counts', await step(ch3, tu('submit_design', { description: 'well pumps', items: [{ id: 'storage_tank', qty: 1 }], custom_items: [{ name: 'Motor pump on shallow wells', cost: 2000, liters_per_day: 12000 }] })), 'counts_toward_target');
  await step(ch3, tu('submit_design', { description: 'well pumps', items: [{ id: 'storage_tank', qty: 1 }], custom_items: [{ name: 'Motor pump on shallow wells', cost: 2000, liters_per_day: 12000, counts_toward_target: false }] }));
  expect('challenge: untreated custom water adds nothing', JSON.stringify(ch3.state.design), '"capacity":0');
  const ch4: any = await startCaseSession('001', true);
  await step(ch4, design(1));
  for (const t of ['rainy_season', 'access']) { await step(ch4, tu('run_stress_test', { test_id: t })); await step(ch4, tu('judge_test', { test_id: t, passed: true })); }
  expect('challenge: test reports the missing piece', await (async () => { await step(ch4, tu('run_stress_test', { test_id: 'recontamination' })); const m = [...ch4.api].reverse().find((x: any) => x.role === 'user' && Array.isArray(x.content)) as any; return String(m.content[0].content); })(), '✘ Water stays safe at home');
  expect('challenge: cannot pass a test with a missing piece', await step(ch4, tu('judge_test', { test_id: 'recontamination', passed: true })), "Can't pass");

  // --- Challenge: settlement needs checklist
  {
    const sh: any = await startCaseSession('004', true);
    const r = await step(sh, tu('submit_design', { description: 'homes only', items: [{ id: 'frame_pegged', qty: 21 }, { id: 'wall_daub', qty: 21 }, { id: 'roof_thatch', qty: 21 }] }));
    const res = [...sh.api].reverse().find((x: any) => x.role === 'user' && Array.isArray(x.content)) as any;
    expect('needs: homes-only design is not finished', String(res.content[0].content), 'nothing for "Latrines (bathrooms)" yet');
    expect('needs: checklist ticks homes', JSON.stringify((await import('../lib/view')).toView(sh).budgetBox?.needs?.slice(0, 2)), '"label":"Homes for everyone (105 of 105)","ok":true},{"icon":"🍲","label":"Cooking for everyone","ok":false');
    await step(sh, tu('update_plan', { plan: [{ id: 'frame_pegged', qty: 21 }, { id: 'wall_daub', qty: 21 }, { id: 'roof_thatch', qty: 21 }, { id: 'hearth', qty: 15 }] }));
    expect('needs: family hearths alone do not feed the bunkhouse', JSON.stringify((await import('../lib/view')).toView(sh).budgetBox?.needs?.[1]), '"label":"Cooking for everyone (60 of 105)","ok":false');
    await step(sh, tu('update_plan', { plan: [{ id: 'frame_pegged', qty: 21 }, { id: 'wall_daub', qty: 21 }, { id: 'roof_thatch', qty: 21 }, { id: 'hearth', qty: 15 }, { id: 'cookhouse', qty: 2 }] }));
    expect('needs: plus two cookhouses feeds everyone', JSON.stringify((await import('../lib/view')).toView(sh).budgetBox?.needs?.[1]), '"ok":true');
    void r;
  }

  // --- Challenge: perfect design must run all tests
  const ch2: any = await startCaseSession('001', true);
  await step(ch2, design(1));
  for (const t of ['rainy_season', 'access', 'recontamination']) { await step(ch2, tu('run_stress_test', { test_id: t })); await step(ch2, tu('judge_test', { test_id: t, passed: true })); }
  expect('challenge: all-pass needs all tests', await step(ch2, close()), "Testing isn't finished");

  // --- Inquiry: key points collect in the side panel
  {
    const { startInquiry } = await import('../lib/sessions');
    const q: any = await startInquiry('What happens in my brain when I have fun?', undefined, true);
    await step(q, tu('record_starting_idea', { idea: 'Happy chemicals' }));
    await step(q, tu('add_key_point', { point: 'Dopamine is a chemical messenger in the brain.' }));
    await step(q, tu('add_key_point', { point: 'Fun = your brain rewarding you.' }));
    await step(q, tu('add_key_point', { point: 'Dopamine signals "do that again!"', replaces_index: 2 }));
    expect('inquiry: key points on screen', JSON.stringify((await import('../lib/view')).toView(q).keyPoints), 'do that again');
  }

  // --- In your words, standards, primary source, supervisor review
  {
    const f: any = await startCaseSession('002', true);
    for (const e of ['english_field', 'powhatan_field', 'soil_test']) await step(f, tu('examine', { evidence_id: e })).catch(() => '');
    await step(f, tu('show_source', {}));
    expect('source card appears in chat', JSON.stringify(f.display.filter((m: any) => m.source).map((m: any) => m.source.author)), 'Thomas Harriot');
    expect('source only once', await step(f, tu('show_source', {})), 'Already shown');
    const ev = (f.caseSnapshot.data.evidence as any[]).map((e) => e.id);
    for (const e of ev.slice(0, 3)) await step(f, tu('examine', { evidence_id: e }));
    await step(f, tu('record_theory', { theory: 'crop + method + ground', supporting: ev.slice(0, 3) }));
    expect('no close without In your words', await step(f, close({ in_your_words: '' })), 'In your words');
    expect('closes with In your words', await step(f, close()), 'Case closed');
    expect('summary keeps her words and standards', JSON.stringify({ w: f.summary.inYourWords, s: f.summary.standards?.[0]?.code }), 'MS-LS1-5');
    const { startReview } = await import('../lib/sessions');
    const r: any = await startReview(true);
    expect('review picks closed cases', JSON.stringify(r.state.reviewCases.map((x: any) => x.caseId)), '"');
    const n = r.state.questionCount;
    expect('review cannot finish early', await step(r, tu('finish_review', { verdict: 'x' })), 'Keep going');
    for (let i = 0; i < n; i++) await step(r, tu('record_answer', { case_id: r.state.reviewCases[0].caseId, question: 'q' + i, result: i ? 'got_it' : 'missed' }));
    await step(r, tu('finish_review', { verdict: 'Not bad, detective.' }));
    expect('review closes with a parent record', JSON.stringify({ st: r.status, p: r.parent?.whatHappened }), `${n - 1} of ${n} remembered`);
    expect('review panel shows marks', JSON.stringify((await import('../lib/view')).toView(r).review?.answers?.[0]), 'missed');
  }

  // --- A wordless turn never shows '…'
  {
    const fx: any = await startCaseSession('002', true);
    const r1 = await runTurn(fx, 'They grew better crops together in better soil.', fakeClient([[tu('record_theory', { theory: 'crops, method, ground', supporting: [] })], [], [tx('That is your ruling, detective.')]]));
    expect('empty reply is rescued', r1.reply, 'That is your ruling');
    const r2 = await runTurn(fx, 'hello?', fakeClient([[], [], []]));
    expect('never shows bare dots', String(r2.reply !== '…'), 'true');
    const last = fx.api.at(-1);
    expect('conversation stays well-formed', String(last.role), 'assistant');
  }

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
    expect('jamestown: fragment reply gets repaired', r.reply, 'You choose');
    expect('jamestown: fragment not shown', String(!r.reply.includes('on your screen')), 'true');
    await step(sim, tu('update_story', { water: { value: 'Muddy river', change: 'worse' }, settlement: { value: 'Wooden fort', change: 'better' } }));
    expect('jamestown: story lines reach the side panel', JSON.stringify((await import('../lib/view')).toView(sim).story), '"value":"Muddy river","dir":"down"');
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
