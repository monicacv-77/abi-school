// Case checker: flags missing or weak pieces before a case goes live.
// Run:  npm run check-cases            (all cases)
//       npm run check-cases -- 006     (one case, by id or file name)
// ❌ = must fix before READY.  ⚠️ = worth a look.  See docs/CASE-STANDARD.md for the why.
import fs from 'node:fs';
import path from 'node:path';
import type { CaseDef, ChallengeData, InvestigationData, SimulationData } from '../lib/types';

const dir = path.join(__dirname, '..', 'cases');
const registry = fs.readFileSync(path.join(__dirname, '..', 'lib', 'cases.ts'), 'utf8');
const only = process.argv[2];

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
// Narrator commentary that points Abi at the answer (noticing is her job).
const LEADING = /\b(notice|noticing|this suggests|which suggests|which means|clearly shows|interesting(ly)?|what'?s missing|look closely|tellingly)\b/i;
// Rules the app now applies to every case; they don't belong in case notes.
const FRAMEWORK_NOTES: [RegExp, string][] = [
  [/^final question/i, 'use wrapUpQuestions instead of a "Final question" note'],
  [/pin real events to her timeline/i, 'timeline pinning is automatic now'],
  [/witnesses can only testify/i, 'the Facilitator Guide covers what witnesses can know'],
  [/^debrief \(after the last decision\)/i, 'Simulations use the built-in debrief + debriefTopics + wrapUpQuestions'],
  [/^turn shape/i, 'the Simulation turn shape is built in'],
];

let errors = 0;
let warnings = 0;

function checkCase(file: string) {
  const c = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as CaseDef;
  const bad: string[] = [];
  const warn: string[] = [];
  const need = (ok: unknown, msg: string) => { if (!ok) bad.push(msg); };
  const hint = (ok: unknown, msg: string) => { if (!ok) warn.push(msg); };

  // ---------- every case
  for (const k of ['id', 'title', 'mode', 'classification', 'unit', 'realOrConstructed', 'status', 'version', 'bigUnderstanding', 'winCondition', 'completion'] as const)
    need(c[k] !== undefined && c[k] !== '', `missing "${k}"`);
  need(registry.includes(file.replace(/\.json$/, '')), `not registered in lib/cases.ts`);

  const intro = c.opening?.intro ?? '';
  need(intro, 'missing opening.intro');
  hint(intro.length >= 350, `opening paragraph is short (${intro.length} chars): set the scene (place, time, what it looks/smells like, who's there) and end with her job`);
  hint(intro.length <= 900, `opening paragraph is long (${intro.length} chars): Abi reads slowly; aim for 2 short paragraphs`);
  hint(intro.split(/\n{2,}/).length >= 2, 'opening is one block: split into a scene paragraph and a "your job" paragraph');
  need(c.opening?.prompt, 'missing opening.prompt (the hand-off question)');
  const cards = c.opening?.cards ?? [];
  need(cards.length >= 2, 'needs at least 2 brief cards');
  hint(cards.some((k) => k.kind === 'brief'), 'no card with kind "brief": add a project brief / your job card (it shows first)');
  hint(cards.length <= 8, `${cards.length} brief cards: more than 8 is a lot to open`);
  for (const k of cards) {
    hint(k.icon, `card "${k.label}" has no emoji icon`);
    hint(k.kind, `card "${k.label}" has no kind (brief = her job, place = setting, voice = experts/witnesses): it will sort last`);
    hint(words(k.text) <= 40, `card "${k.label}" is ${words(k.text)} words: keep cards to 1–2 short sentences (≤40 words)`);
  }
  need(c.image?.src && c.image.credit && c.image.href, 'needs a hero image with credit and link');
  need(c.scaffolds?.length >= 2, 'needs at least 2 scaffold hints (light → strong)');
  need(c.endReveal?.concept && c.endReveal.realVsConstructed?.real && c.endReveal.realVsConstructed?.constructed, 'endReveal needs concept + real vs. constructed');
  hint(c.endReveal?.vocabulary?.length >= 2, 'endReveal: add 2+ vocabulary terms for the Case Summary');
  hint(c.skills?.length >= 2, 'list 2+ skills for the Case Summary');
  need((c.followUpSeeds?.length ?? 0) >= 3, 'needs 3+ followUpSeeds (directions for Keep exploring)');
  hint((c.standards?.length ?? 0) >= 2, 'list 2+ standards this case covers (shown on the Case Summary)');
  hint(c.mode === 'challenge' || c.primarySource || !/real|history|histor/i.test(c.realOrConstructed + c.unit), 'history case with no primarySource: add one short, verified real source');
  if (c.primarySource) need(c.primarySource.original && c.primarySource.modern && c.primarySource.href && c.primarySource.when, 'primarySource needs original, modern, href and when');
  for (const n of c.facilitatorNotes ?? []) for (const [re, why] of FRAMEWORK_NOTES) if (re.test(n.trim())) warn.push(`note "${n.slice(0, 40)}…": ${why}`);

  // ---------- by mode
  if (c.mode === 'challenge') {
    const d = c.data as ChallengeData;
    const ids = new Set(d.toolbox.map((t) => t.id));
    need(d.designFor, 'needs data.designFor: exactly who the design serves (how many people, ages, families)');
    need((c.wrapUpQuestions?.length ?? 0) >= 1, 'needs wrapUpQuestions (e.g. "Would you approve this? Why?")');
    need(d.buildingBlocks?.length >= 3, 'needs 3+ buildingBlocks (categories Abi sees, no prices)');
    need(d.toolbox?.length >= 6, 'toolbox is thin: 6+ priced items');
    hint(d.toolbox.some((t) => t.hidden), 'no hidden toolbox items: add a few for good ideas Abi might invent');
    need(d.measurements?.length >= 3, 'needs 3+ measurements she can ask for');
    need(d.stressTests?.length >= 3 && d.stressTests.every((t) => t.passesIf), 'needs 3+ stress tests, each with passesIf');
    need((d.minCapacity ?? d.minLitersPerDay) !== undefined, 'needs a capacity target (minCapacity)');
    for (const t of d.toolbox) {
      for (const n of t.needs ?? []) for (const alt of n.split('|')) if (!alt.startsWith('existing:') && !ids.has(alt)) bad.push(`toolbox "${t.id}" needs unknown id "${alt}"`);
      for (const l of t.limitedBy ?? []) if (!ids.has(l)) bad.push(`toolbox "${t.id}" limitedBy unknown id "${l}"`);
    }
    hint(d.stressTests.some((t) => t.checks?.length), 'no stress test lists required pieces (checks): add them so a design missing something essential fails for sure');
    for (const n of d.needs ?? []) for (const id of n.anyOf) if (!ids.has(id)) bad.push(`need "${n.label}" refers to unknown id "${id}"`);
    for (const t of d.stressTests) for (const ch of t.checks ?? []) for (const id of ch.anyOf) if (!ids.has(id)) bad.push(`stress test "${t.id}" check refers to unknown id "${id}"`);
    hint(d.capacityRule || !d.toolbox.some((t) => /untreated|not safe|raw/i.test(t.provides)), 'some items make raw/untreated output: add a capacityRule saying what counts toward the target');
    for (const m of d.measurements) if (LEADING.test(m.result)) warn.push(`measurement "${m.id}" result sounds like commentary: state the facts only`);
  }

  if (c.mode === 'investigation') {
    const d = c.data as InvestigationData;
    hint(d.resolved || c.status !== 'READY', 'unsolved mystery marked READY: Abi needs an answer she can reach (or make it a bonus)');
    need(d.evidence?.length >= 8, `only ${d.evidence?.length ?? 0} evidence items: aim for 8–12, incl. a red herring`);
    need(d.theories?.length >= 2, 'needs 2+ theories with supporting/weakening evidence');
    need(d.trueExplanation, 'needs trueExplanation');
    hint(d.evidence.some((e) => e.image), 'no evidence has a picture: one real document or object image helps a lot');
    const ev = new Set(d.evidence.map((e) => e.id));
    for (const t of d.theories) for (const id of [...t.supportedBy, ...t.weakenedBy]) if (!ev.has(id)) bad.push(`theory "${t.theory.slice(0, 30)}…" refers to unknown evidence "${id}"`);
    for (const e of d.evidence) if (LEADING.test(e.result)) warn.push(`evidence "${e.id}" result sounds like commentary: state the facts only`);
  }

  if (c.mode === 'simulation') {
    const d = c.data as SimulationData;
    const stats = new Set(d.stats.map((s) => s.id));
    const dec = new Map(d.decisions.map((x) => [x.id, new Set(x.options.map((o) => o.id))]));
    const evs = new Set(d.fixedEvents.map((e) => e.id));
    need(d.role, 'needs data.role');
    hint(/president|leader|captain|governor|chief|council|commander|head|judge/i.test(d.role), 'role: give Abi an important role with real pressure, not a bystander');
    need(d.decisions.length >= 6, `only ${d.decisions.length} decisions: aim for 8–10`);
    need((d.debriefTopics?.length ?? 0) >= 3, 'needs 3+ debriefTopics for "Yours vs. the real one"');
    need((c.wrapUpQuestions?.length ?? 0) >= 2, 'needs wrapUpQuestions (usually 4)');
    need(d.historyComparison, 'needs historyComparison');
    need(d.sequence?.length, 'needs a sequence (order of play)');
    for (const st of d.stats) if (st.kind !== 'count') hint(st.scale?.length, `stat "${st.id}" has no word scale: words read easier than numbers`);
    for (const x of d.decisions) {
      need(x.options.length >= 3 && x.options.length <= 4, `decision "${x.id}" needs 3–4 options`);
      for (const o of x.options) for (const k of Object.keys(o.effects)) if (!stats.has(k)) bad.push(`decision "${x.id}/${o.id}" changes unknown stat "${k}"`);
    }
    for (const id of d.sequence ?? []) if (!dec.has(id) && !evs.has(id)) bad.push(`sequence has unknown id "${id}"`);
    for (const id of d.requiredDecisions ?? []) if (!dec.has(id)) bad.push(`requiredDecisions has unknown id "${id}"`);
    for (const e of d.fixedEvents) {
      for (const k of Object.keys(e.effects ?? {})) if (!stats.has(k)) bad.push(`event "${e.id}" changes unknown stat "${k}"`);
      for (const m of e.modifiers ?? []) {
        const [di, oi] = m.ifChoice.split(':');
        if (!dec.get(di)?.has(oi)) bad.push(`event "${e.id}" modifier refers to unknown choice "${m.ifChoice}"`);
      }
    }
    for (const t of d.triggers ?? []) if (!stats.has(t.stat)) bad.push(`trigger "${t.id}" watches unknown stat "${t.stat}"`);
  }

  const live = c.status === 'READY' || c.status === 'PILOT';
  if (live) errors += bad.length;
  warnings += warn.length;
  const mark = bad.length ? '❌' : warn.length ? '⚠️ ' : '✅';
  console.log(`\n${mark} ${c.id} ${c.title} (${c.mode}, ${c.status}, v${c.version})${bad.length && !live ? '  [not live yet, so these don\'t block]' : ''}`);
  for (const b of bad) console.log(`   ❌ ${b}`);
  for (const w of warn) console.log(`   ⚠️  ${w}`);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const pick = only ? files.filter((f) => f.startsWith(only) || f.includes(only)) : files;
if (!pick.length) {
  console.log(`No case file matches "${only}".`);
  process.exit(1);
}
for (const f of pick) checkCase(f);
console.log(`\n${errors} must-fix in live cases, ${warnings} worth a look.`);
process.exit(errors ? 1 : 0);
