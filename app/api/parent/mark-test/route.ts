// Parent-only: move a session out of Abi's record into test runs (e.g. when you tried a case yourself).
import { NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/sessions';

export async function POST(req: Request) {
  const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const s = sessionId ? await getSession(sessionId) : null;
  if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  s.isTest = true;
  await saveSession(s);
  return NextResponse.json({ ok: true });
}
