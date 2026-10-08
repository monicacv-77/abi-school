// The engine: builds the same instructions every turn, runs the tool loop,
// enforces stage rules through the mode handlers, and saves everything.
import Anthropic from '@anthropic-ai/sdk';
import { FACILITATOR_GUIDE } from './guide';
import { ENGINES, toolsFor } from './modes';
import { caseFor } from './cases';
import { addTimeline, addWonder, saveSession } from './sessions';
import type { CaseDef, CaseSummary, Session } from './types';

export const MODEL = process.env.ABI_MODEL || 'claude-sonnet-5-5';
const MAX_STEPS = 8;
const RESUME_GAP_MS = 4 * 60 * 60 * 1000;

const METHOD: Record<Session['mode'], string> = {
  challenge: 'Challenge',
  investigation: 'Investigation',
  simulation: 'Simulation',
  inquiry: 'Inquiry',
};

function caseSpec(c: CaseDef): string {
  return [
    `CASE ${c.id} — ${c.title.toUpperCase()}`,
    `How to win (on Abi's screen): ${c.winCondition}`,
    `Mode: ${METHOD[c.mode]} · Classification: ${c.classification} · Location: ${c.location ?? '—'} · ${c.realOrConstructed} · Case version ${c.version}`,
    `Big understanding (hidden): ${c.bigUnderstanding}`,
    `ALREADY ON ABI'S SCREEN (don't repeat it unless she asks):\n${c.opening.intro}\n${c.opening.cards.map((k) => `[${k.label}] ${k.text}`).join('\n')}\n${c.opening.prompt}`,
    `Case-specific facilitator notes:\n${c.facilitatorNotes.map((n) => `- ${n}`).join('\n')}`,
    `Concepts to explain just in time:\n${c.justInTimeConcepts.map((n) => `- ${n}`).join('\n')}`,
    `Scaffold ladder (light → strong, only if she's stuck):\n${c.scaffolds.map((n, i) => `${i + 1}. ${n}`).join('\n')}`,
    `Completion criteria: ${c.completion}`,
    `End reveal (after close only): ${c.endReveal.concept}\nVocabulary: ${c.endReveal.vocabulary.map((v) => `${v.term} = ${v.meaning}`).join('; ')}\nReal: ${c.endReveal.realVsConstructed.real}\nConstructed: ${c.endReveal.realVsConstructed.constructed}`,
    `Skills for the summary: ${c.skills.join(', ')}`,
    c.followUpSeeds?.length ? `Follow-up directions for the 'Keep exploring' questions at close: ${c.followUpSeeds.join('; ')}` : '',
    c.timelineEvents?.length ? `Timeline events you may pin when they come up: ${c.timelineEvents.map((t) => `${t.year} — ${t.label}`).join('; ')}` : '',
    `CASE DATA\n${(ENGINES[c.mode] as { spec: (c: CaseDef) => string }).spec(c)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildSystem(s: Session, c: CaseDef | undefined): Anthropic.Messages.TextBlockParam[] {
  const engine = ENGINES[s.mode];
  const staticPart =
    `${engine.rules}\n\n` + (c ? caseSpec(c) : (ENGINES.inquiry.spec as (c: null, s: Session) => string)(null, s));
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
  };
}

async function runTool(s: Session, c: CaseDef | undefined, name: string, input: any): Promise<{ result: string; isError?: boolean }> {
  if (name === 'save_wonder') {
    await addWonder(String(input.question ?? ''));
    return { result: 'Saved to the Wonder List.' };
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

  // Thinking blocks are sealed to the exact system prompt they were made with. Ours changes every
  // turn (live game state), so drop thinking from earlier turns. Within this turn's tool loop the
  // system prompt is identical, so new thinking blocks stay valid there.
  s.api = s.api.map((m) => {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) return m;
    const kept = (m.content as { type: string }[]).filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking');
    return { ...m, content: kept.length ? kept : 'Okay.' };
  });

  const system = buildSystem(s, c);
  const tools = toolsFor(s.mode);
  const replyParts: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system,
      tools,
      messages: s.api as Anthropic.Messages.MessageParam[],
    });
    s.api.push({ role: 'assistant', content: res.content });
    for (const b of res.content) if (b.type === 'text' && b.text.trim()) replyParts.push(b.text.trim());
    if (res.stop_reason !== 'tool_use') break;
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const b of res.content) {
      if (b.type !== 'tool_use') continue;
      const out = await runTool(s, c, b.name, b.input);
      results.push({ type: 'tool_result', tool_use_id: b.id, content: out.result, is_error: out.isError });
    }
    s.api.push({ role: 'user', content: results });
  }

  // Keep the conversation well-formed if we stopped mid tool loop.
  const lastMsg = s.api[s.api.length - 1];
  if (lastMsg?.role === 'user') s.api.push({ role: 'assistant', content: replyParts.at(-1) ?? 'Okay.' });

  const reply = replyParts.join('\n\n') || '…';
  s.display.push({ role: 'guide', text: reply, at: new Date().toISOString() });
  await saveSession(s);
  return { reply, session: s };
}

/** The very first message of an Inquiry: Abi's question goes in as her first turn. */
export async function startInquiryTurn(s: Session, client?: Anthropic) {
  return runTurn(s, s.question ?? '', client);
}
