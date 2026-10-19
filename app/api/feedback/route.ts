// Abi's end-of-case feedback: how fun, how hard, and anything she'd change.
import { NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/sessions';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { sessionId?: string; fun?: string; difficulty?: string; comment?: string };
  const s = b.sessionId ? await getSession(b.sessionId) : null;
  if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const prev = s.feedback ?? { at: new Date().toISOString() };
  s.feedback = {
    fun: (['great', 'ok', 'meh'].includes(String(b.fun)) ? b.fun : prev.fun) as 'great' | 'ok' | 'meh' | undefined,
    difficulty: (['easy', 'right', 'hard'].includes(String(b.difficulty)) ? b.difficulty : prev.difficulty) as 'easy' | 'right' | 'hard' | undefined,
    comment: typeof b.comment === 'string' ? b.comment.trim().slice(0, 1000) : prev.comment,
    at: new Date().toISOString(),
  };
  await saveSession(s);
  return NextResponse.json({ ok: true, feedback: s.feedback });
}
