import { NextResponse } from 'next/server';
import { getSession } from '@/lib/sessions';
import { runTurn } from '@/lib/engine';
import { toView } from '@/lib/view';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { sessionId, text } = (await req.json().catch(() => ({}))) as { sessionId?: string; text?: string };
  if (!sessionId || !text?.trim()) return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  const s = await getSession(sessionId);
  if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  try {
    const { session } = await runTurn(s, text);
    return NextResponse.json({ view: toView(session) });
  } catch (err) {
    console.error('turn failed', err);
    return NextResponse.json({ error: `The guide hit a snag (${(err as Error).message}). Try sending that again.` }, { status: 500 });
  }
}
