// Offline check of the engine's tool loop and stage rules, using a scripted fake model.
import { startCaseSession, getSession } from '../lib/sessions';
import { runTurn } from '../lib/engine';

function fakeClient(script: any[][]) {
  let i = 0;
  return { messages: { create: async () => {
    const blocks = script[i++] ?? [{ type: 'text', text: 'ok' }];
    const tool = blocks.some((b: any) => b.type === 'tool_use');
    return { content: blocks, stop_reason: tool ? 'tool_use' : 'end_turn' };
  } } } as any;
}
const tu = (name: string, input: any) => ({ type: 'tool_use', id: 'tu_' + Math.random().toString(36).slice(2), name, input });
const tx = (text: string) => ({ type: 'text', text });

async function main() {
  const s = await startCaseSession('001', true);
  await runTurn(s, 'how much is a solar pump', fakeClient([[tu('look_up', { item_ids: ['solar_pump','tap_stand'] })], [tx('5k')]]));
  await runTurn(s, 'test the borehole', fakeClient([[tu('take_measurement', { measurement_id: 'borehole_water_test' })], [tx('Clean!')]]));
  await runTurn(s, 'run a stress test', fakeClient([[tu('run_stress_test', { test_id: 'rainy_season' })], [tx('no design yet')]]));
  await runTurn(s, 'build it', fakeClient([[tu('submit_design', { description: 'borehole + solar + tank + taps', items: [{ id: 'repair_borehole', qty: 1 }, { id: 'solar_pump', qty: 1 }, { id: 'storage_tank', qty: 1 }, { id: 'tap_stand', qty: 6 }, { id: 'pipe_km', qty: 3 }] })], [tx('designed')]]));
  await runTurn(s, 'close it', fakeClient([[tu('close_case', { abi_final_words: 'x', hook: 'h', quote: 'q', quote_label: 'l', visual: { kind: 'list', title: 't', items: ['a'] }, found_title: 'f', found: ['a'], parent_what_happened: 'p' })], [tx('not yet')]]));
  for (const t of ['rainy_season', 'access', 'recontamination']) await runTurn(s, 'test', fakeClient([[tu('run_stress_test', { test_id: t })], [tx('ran ' + t)]]));
  await runTurn(s, 'yes approve', fakeClient([[tu('close_case', { abi_final_words: 'I approve', hook: 'h', quote: 'q', quote_label: 'l', visual: { kind: 'list', title: 't', items: ['a'] }, found_title: 'f', found: ['a'], follow_ups: ['How do solar pumps work?', 'How does my town clean water?', 'Who invented water filters?'], parent_what_happened: 'p' })], [tx('closed!')]]));
  const after = await getSession(s.id);
  const results = after!.api.filter((m: any) => m.role === 'user' && Array.isArray(m.content)).map((m: any) => m.content[0].content.split('\n')[0]);
  console.log(results.join('\n'));
  console.log('followUps:', JSON.stringify(after!.followUps)); console.log('status:', after!.status, '| design:', JSON.stringify(after!.state.design));
}
main();
