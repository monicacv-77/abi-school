// Runs a case against a simulated student so we can review transcripts before Abi plays.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCase } from '@/lib/cases';
import { startCaseSession, startInquiry } from '@/lib/sessions';
import { MODEL, runTurn, startInquiryTurn } from '@/lib/engine';

export const maxDuration = 300;

const PERSONAS: Record<string, string> = {
  rusher: 'You answer fast and short (often under 10 words), jump to solutions, sometimes skip reading, and crack jokes.',
  curious: 'You ask lots of "why" and "how does that work" questions before deciding anything.',
  unusual: 'You propose creative, unusual but physically plausible ideas, and push back when the guide disagrees.',
  stuck: 'You often say "idk" or "I\'m not sure" and need nudges, but you try when given a hint.',
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { caseId?: string; persona?: string; turns?: number; question?: string };
  const persona = PERSONAS[body.persona ?? 'rusher'] ?? PERSONAS.rusher;
  const turns = Math.max(1, Math.min(14, body.turns ?? 10));
  const client = new Anthropic();

  let s;
  let openingText = '';
  if (body.question) {
    s = await startInquiry(body.question, undefined, true);
    await startInquiryTurn(s, client);
  } else {
    const c = body.caseId ? getCase(body.caseId) : undefined;
    if (!c) return NextResponse.json({ error: 'Unknown case' }, { status: 404 });
    s = await startCaseSession(c.id, true);
    openingText = `${c.opening.intro}\n${c.opening.cards.map((k) => `${k.label}: ${k.text}`).join('\n')}\n${c.opening.prompt}`;
  }

  for (let i = 0; i < turns && s.status === 'active'; i++) {
    const transcript = s.display.map((m) => `${m.role === 'abi' ? 'YOU' : 'GUIDE'}: ${m.text}`).join('\n');
    const student = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: `You are role-playing a witty 13-year-old 8th grader who loves science, reads slowly, and is using a learning app. ${persona} Write only your next chat message, the way a teenager types. Try to actually make progress and eventually finish the case.`,
      messages: [{ role: 'user', content: `${openingText ? `SCREEN SHOWS:\n${openingText}\n\n` : ''}CHAT SO FAR:\n${transcript || '(nothing yet)'}\n\nYour next message:` }],
    });
    const text = student.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim() || 'ok';
    await runTurn(s, text, client);
  }

  const words = s.display.filter((m) => m.role === 'guide').map((m) => m.text.split(/\s+/).length);
  return NextResponse.json({
    sessionId: s.id,
    status: s.status,
    stage: s.stage,
    guideWordsAvg: words.length ? Math.round(words.reduce((a, b) => a + b, 0) / words.length) : 0,
    guideWordsMax: Math.max(0, ...words),
    transcript: s.display.map((m) => `${m.role === 'abi' ? 'STUDENT' : 'GUIDE'}: ${m.text}`),
    summary: s.summary ?? null,
  });
}
