import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PARENT_COOKIE, parentToken } from '@/lib/auth';
import { getCase } from '@/lib/cases';
import { startCaseSession, startInquiry } from '@/lib/sessions';
import { startInquiryTurn } from '@/lib/engine';

export const maxDuration = 120;

// Start a case (caseId) or an Inquiry (question). Parents can start test runs of any case.
export async function POST(req: Request) {
  try {
    return await start(req);
  } catch (e) {
    console.error('start failed', e);
    return NextResponse.json({ error: `Couldn't open the case: ${(e as Error).message}` }, { status: 500 });
  }
}

async function start(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { caseId?: string; question?: string; wonderId?: string; test?: boolean };
  const isParent = (await cookies()).get(PARENT_COOKIE)?.value === (await parentToken());
  const isTest = Boolean(body.test && isParent);

  if (body.question) {
    const q = body.question.trim();
    if (!q) return NextResponse.json({ error: 'Empty question' }, { status: 400 });
    const s = await startInquiry(q, body.wonderId, isTest);
    await startInquiryTurn(s);
    return NextResponse.json({ id: s.id });
  }

  const c = body.caseId ? getCase(body.caseId) : undefined;
  if (!c) return NextResponse.json({ error: 'Unknown case' }, { status: 404 });
  if (c.status !== 'READY' && !isTest) return NextResponse.json({ error: 'That case is not ready yet' }, { status: 403 });
  const s = await startCaseSession(c.id, isTest);
  return NextResponse.json({ id: s.id });
}
