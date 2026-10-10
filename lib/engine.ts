// The engine: builds the same instructions every turn, runs the tool loop,
// enforces stage rules through the mode handlers, and saves everything.
import Anthropic from '@anthropic-ai/sdk';
import { FACILITATOR_GUIDE } from './guide';
import { ENGINES, toolsFor } from './modes';
import { caseFor } from './cases';
import { addTimeline, addWonder, saveSession } from './sessions';
import type { CaseDef, CaseSummary, DisplayMessage, Session } from './types';

export const MODEL = process.env.ABI_MODEL || 'claude-sonnet-5-5';
const MAX_STEPS = 14; // room for a full test run (run + judge for each test) in one turn
const RESUME_GAP_MS = 4 * 60 * 60 * 1000;

const METHOD: Record<Session['mode'], string> = {
  challenge: 'Challenge',
  investigation: 'Investigation',
  simulation: 'Simulation',
  inquiry: 'Inquiry',
  review: 'Review',
};

function caseSpec(c: CaseDef): string {
  return [
    `CASE ${c.id} — ${c.title.toUpperCase()}`,
    `Her goal (stated in her opening paragraph and brief): ${c.winCondition}`,
    `Mode: ${METHOD[c.mode]} · Classification: ${c.classification} · Location: ${c.location ?? '—'} · ${c.realOrConstructed} · Case version ${c.version}`,
    `Big understanding (hidden): ${c.bigUnderstanding}`,
    `ALREADY ON ABI'S SCREEN (don't repeat it unless she asks):\n${c.opening.intro}\n${c.opening.cards.map((k) => `[${k.label}] ${k.text}`).join('\n')}\n${c.opening.prompt}`,
    `Case-specific facilitator notes:\n${c.facilitatorNotes.map((n) => `- ${n}`).join('\n')}`,
    `Concepts to explain just in time:\n${c.justInTimeConcepts.map((n) => `- ${n}`).join('\n')}`,
    `Scaffold ladder (light → strong, only if she's stuck):\n${c.scaffolds.map((n, i) => `${i + 1}. ${n}`).join('\n')}`,
    `Completion criteria: ${c.completion}`,
    `End reveal (after close only): ${c.endReveal.concept}\nVocabulary: ${c.endReveal.vocabulary.map((v) => `${v.term} = ${v.meaning}`).join('; ')}\nReal: ${c.endReveal.realVsConstructed.real}\nConstructed: ${c.endReveal.realVsConstructed.constructed}`,
    `Skills for the summary: ${c.skills.join(', ')}`,
    c.wrapUpQuestions?.length ? `WRAP-UP QUESTIONS (the very end, after everything else; ask exactly these, one at a time, no follow-ups):\n${c.wrapUpQuestions.map((q, i) => `Q${i + 1}. ${q}`).join('\n')}` : '',
    c.followUpSeeds?.length ? `Follow-up directions for the 'Keep exploring' questions at close: ${c.followUpSeeds.join('; ')}` : '',
    c.primarySource
      ? c.primarySource.inDialogue
        ? `REAL WORDS IN THE STORY (${c.primarySource.author}, ${c.primarySource.year}): ${c.primarySource.when}, have ${c.primarySource.author} say these real words in character, as one or two beats, close to this modern version: "${c.primarySource.modern}" Then one short beat noting these are his real words, written in 1607. Don't change their meaning.`
        : `PRIMARY SOURCE (real, ${c.primarySource.author}, ${c.primarySource.year}): show it once with show_source ${c.primarySource.when}. Modern version: "${c.primarySource.modern}"`
      : '',
    `CASE DATA\n${(ENGINES[c.mode] as { spec: (c: CaseDef) => string }).spec(c)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildSystem(s: Session, c: CaseDef | undefined): Anthropic.Messages.TextBlockParam[] {
  const engine = ENGINES[s.mode];
  const staticPart =
    `${engine.rules}\n\n` + (c ? caseSpec(c) : (ENGINES[s.mode].spec as (c: null, s: Session) => string)(null, s));
  const last = s.display.length ? new Date(s.display[s.display.length - 1].at).getTime() : 0;
  const resumed = last && Date.now() - last > RESUME_GAP_MS;
  const status = (engine.status as (s: Session, c: CaseDef) => string)(s, c as CaseDef);
  const dynamic = [
    `CURRENT STATE (updated every turn): ${status}`,
    resumed ? 'Abi is coming back after a break. Start with a 1–2 sentence recap of where things stand, then continue.' : '',
    s.status === 'closed' ? 'This case is CLOSED. Answer follow-up questions briefly; do not reopen it.' : '',
    `Today: ${new Date().toDateString()}.`,
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { type: 'text', text: FACILITATOR_GUIDE },
    { type: 'text', text: staticPart, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamic },
  ];
}

function buildSummary(s: Session, c: CaseDef | undefined, input: any): CaseSummary {
  const v = input.visual ?? {};
  return {
    number: c ? c.id : 'Q',
    title: c ? c.title : s.question ?? s.title,
    classification: c ? c.classification : 'Open Question',
    method: METHOD[s.mode],
    hook: String(input.hook ?? ''),
    quote: String(input.quote ?? input.abi_final_words ?? ''),
    quoteLabel: String(input.quote_label ?? 'My conclusion'),
    visual: {
      kind: ['chain', 'list', 'compare'].includes(v.kind) ? v.kind : 'list',
      title: String(v.title ?? ''),
      items: Array.isArray(v.items) ? v.items.map(String) : [],
      itemsB: Array.isArray(v.items_b) ? v.items_b.map(String) : undefined,
      labelA: v.label_a ? String(v.label_a) : undefined,
      labelB: v.label_b ? String(v.label_b) : undefined,
    },
    foundTitle: String(input.found_title ?? 'What I found'),
    found: Array.isArray(input.found) ? input.found.map(String) : [],
    keyIdeas: Array.isArray(input.key_ideas) && input.key_ideas.length ? input.key_ideas : c ? c.endReveal.vocabulary.slice(0, 4) : [],
    skills: Array.isArray(input.skills) && input.skills.length ? input.skills.map(String) : c ? c.skills : ['Asking Questions', 'Reasoning'],
    realOrConstructed: c ? `${c.endReveal.realVsConstructed.real.split('.')[0]}. Invented: ${c.endReveal.realVsConstructed.constructed.split('.')[0].toLowerCase()}.` : 'A real question, explored with real science and history.',
    closedAt: new Date().toISOString(),
    inYourWords: String(input.in_your_words ?? '').trim() || undefined,
    standards: c?.standards,
  };
}

async function runTool(s: Session, c: CaseDef | undefined, name: string, input: any): Promise<{ result: string; isError?: boolean }> {
  if (name === 'save_wonder') {
    await addWonder(String(input.question ?? ''));
    return { result: 'Saved to the Wonder List.' };
  }
  if (name === 'show_source') {
    const src = c?.primarySource;
    if (!src) return { result: 'This case has no primary source.', isError: true };
    if (s.state.sourceShown) return { result: 'Already shown.', isError: true };
    s.state.sourceShown = true;
    s.state.showSource = true;
    return { result: `The source card is now on her screen above your message: ${src.author}, "${src.title}" (${src.year}). Modern version: "${src.modern}" Don't repeat or read it out (she can tap read-aloud). Say one short line introducing who wrote it, then ask ONE question: what does it tell us, and should we trust it?` };
  }
  if (name === 'pin_to_timeline') {
    await addTimeline({ year: String(input.year), label: String(input.label), caseId: s.caseId, caseTitle: c?.title ?? s.title });
    s.state.timeline = [...(Array.isArray(s.state.timeline) ? s.state.timeline : []), { year: input.year, label: input.label }];
    return { result: 'Pinned.' };
  }
  if (name === 'close_case') {
    if (s.status === 'closed') return { result: 'Already closed.', isError: true };
    const blocker = (ENGINES[s.mode].canClose as (s: Session, c: CaseDef) => string | null)(s, c as CaseDef);
    if (blocker) return { result: `Can't close yet: ${blocker}`, isError: true };
    if (!String(input.in_your_words ?? '').trim())
      return { result: "Can't close yet: ask for her ✍️ In your words paragraph first (see CLOSING A CASE), then close with it word for word.", isError: true };
    s.summary = buildSummary(s, c, input);
    s.parent = {
      whatHappened: String(input.parent_what_happened ?? ''),
      scaffoldsUsed: String(input.parent_scaffolds_used ?? ''),
      concepts: Array.isArray(input.parent_concepts) ? input.parent_concepts.map(String) : [],
      notes: '',
    };
    s.followUps = (Array.isArray(input.follow_ups) ? input.follow_ups : [])
      .map((q: unknown) => String(q).trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((q: string) => (q.length > 140 ? q.slice(0, 137) + '…' : q));
    s.status = 'closed';
    s.stage = 'closed';
    return {
      result:
        "Case closed and Case Summary saved. Now give the short end reveal (concept name, real vs. invented) in 3–5 sentences. Her 'Keep exploring' questions appear as buttons below your message: don't list them; at most say one short line inviting her to pick one.",
    };
  }
  const out = (ENGINES[s.mode].handle as (n: string, i: unknown, s: Session, c: CaseDef) => { result: string; isError?: boolean } | null)(name, input, s, c as CaseDef);
  return out ?? { result: `Unknown tool ${name}`, isError: true };
}

export interface TurnResult {
  reply: string;
  session: Session;
}

export async function runTurn(s: Session, userText: string, client = new Anthropic()): Promise<TurnResult> {
  const c = caseFor(s);
  const now = new Date().toISOString();
  const text = userText.trim().slice(0, 2000);
  s.api.push({ role: 'user', content: text });
  s.display.push({ role: 'abi', text, at: now });
  if (s.mode === 'simulation') s.state.deltaFresh = true;

  // Thinking blocks are sealed to the exact system prompt they were made with. Ours changes every
  // turn (live game state), so drop thinking from earlier turns. Within this turn's tool loop the
  // system prompt is identical, so new thinking blocks stay valid there.
  s.api = s.api.map((m) => {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) return m;
    const kept = (m.content as { type: string }[]).filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking');
    return { ...m, content: kept.length ? kept : 'Okay.' };
  });

  const system = buildSystem(s, c);
  const tools = toolsFor(s.mode).filter((t) => t.name !== 'show_source' || Boolean(c?.primarySource && !c.primarySource.inDialogue));
  const replyParts: string[] = [];
  const choicesBefore = Array.isArray(s.state.choices) ? s.state.choices.length : 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000, // room for the Case Summary at close
      system,
      tools,
      messages: s.api as Anthropic.Messages.MessageParam[],
    });
    // If the model ran out of room mid tool call, drop the half-written call (it can't be run).
    const content = res.stop_reason === 'max_tokens' ? res.content.filter((b) => b.type !== 'tool_use') : res.content;
    if (content.length) s.api.push({ role: 'assistant', content });
    for (const b of content) if (b.type === 'text' && b.text.trim()) replyParts.push(b.text.trim());
    if (res.stop_reason !== 'tool_use') break;
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const b of res.content) {
      if (b.type !== 'tool_use') continue;
      const out = await runTool(s, c, b.name, b.input);
      results.push({ type: 'tool_result', tool_use_id: b.id, content: out.result, is_error: out.isError });
    }
    s.api.push({ role: 'user', content: results });
  }

  // Safety net: never leave Abi with an empty reply. If the turn produced no words (it only ran
  // tools, or ran out of room), ask once more for the message to Abi, with tools switched off.
  if (!replyParts.length) {
    try {
      const msgs = [...(s.api as Anthropic.Messages.MessageParam[])];
      if (msgs.at(-1)?.role === 'assistant') msgs.push({ role: 'user', content: '[App note, not from Abi: your last turn had no message for Abi. Write it now, based on the tool results above. If the case just closed, give the short end reveal. Do not mention this note.]' });
      else if (msgs.at(-1)?.role === 'user' && Array.isArray(msgs.at(-1)!.content)) {
        // tool results are last: the note rides along with them
        msgs[msgs.length - 1] = { role: 'user', content: [...(msgs.at(-1)!.content as Anthropic.Messages.ContentBlockParam[]), { type: 'text', text: '[App note, not from Abi: now write your message to Abi based on these results. Do not mention this note.]' }] };
      }
      const fix = await client.messages.create({ model: MODEL, max_tokens: 2000, system, tools, tool_choice: { type: 'none' }, messages: msgs });
      const text = fix.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.Messages.TextBlock).text.trim()).join('\n\n');
      if (text) {
        replyParts.push(text);
        if (s.api.at(-1)?.role === 'assistant') s.api.pop(); // replace the wordless turn
        s.api.push({ role: 'assistant', content: text });
      }
    } catch {
      // fall through to the friendly fallback below
    }
  }

  // Keep the conversation well-formed if we stopped mid tool loop.
  const lastMsg = s.api[s.api.length - 1];
  if (lastMsg?.role === 'user') s.api.push({ role: 'assistant', content: replyParts.at(-1) ?? 'Okay.' });

  // Safety net for Simulations: if she made a choice this turn but the reply lost its main text
  // (no colony card), ask once more for the complete turn and use that instead.
  const choseNow = s.mode === 'simulation' && (Array.isArray(s.state.choices) ? s.state.choices.length : 0) > choicesBefore;
  if (choseNow && !/you choose/i.test(replyParts.join(' '))) {
    try {
      const fix = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system,
        tools,
        tool_choice: { type: 'none' },
        messages: [
          ...(s.api as Anthropic.Messages.MessageParam[]),
          { role: 'user', content: '[App note, not from Abi: your reply was missing the main part of this turn. Write the complete turn now as one message: "**You choose …**" and the consequence, the short **What changed** list, any event that happened, then the next decision heading, situation and question. Use only the tool results above. Do not mention this note, buttons or the screen.]' },
        ],
      });
      const fixed = fix.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.Messages.TextBlock).text.trim()).join('\n\n');
      if (fixed && /you choose/i.test(fixed)) {
        const last = s.api[s.api.length - 1];
        if (last?.role === 'assistant' && (typeof last.content === 'string' || (Array.isArray(last.content) && (last.content as { type: string }[]).every((b) => b.type !== 'tool_use')))) s.api.pop();
        s.api.push({ role: 'assistant', content: fixed });
        replyParts.length = 0;
        replyParts.push(fixed);
      }
    } catch {
      // keep the original reply
    }
  }

  const reply = replyParts.join('\n\n') || "Hmm, I lost my train of thought there. Could you send that again?";
  const shown = Array.isArray(s.state.showImages) ? (s.state.showImages as DisplayMessage['image'][]) : [];
  for (const image of shown) if (image) s.display.push({ role: 'guide', text: '', image, at: new Date().toISOString() });
  s.state.showImages = [];
  if (s.state.showSource && c?.primarySource) {
    const { author, title, year, original, modern, href } = c.primarySource;
    s.display.splice(s.display.length, 0, { role: 'guide', text: '', source: { author, title, year, original, modern, href }, at: new Date().toISOString() });
    s.state.showSource = false;
  }
  s.display.push({ role: 'guide', text: reply, at: new Date().toISOString() });
  await saveSession(s);
  return { reply, session: s };
}

/** The Supervisor opens a review: a hidden first prompt, so the review starts with the Supervisor talking. */
export async function startReviewTurn(s: Session, client?: Anthropic) {
  const r = await runTurn(s, '[Abi opens the door. Introduce yourself in 1–2 sentences, say which cases you are reviewing and how many questions, then ask Question 1.]', client);
  if (s.display[0]?.role === 'abi') s.display.shift();
  await saveSession(s);
  return r;
}

/** The very first message of an Inquiry: Abi's question goes in as her first turn. */
export async function startInquiryTurn(s: Session, client?: Anthropic) {
  return runTurn(s, s.question ?? '', client);
}
