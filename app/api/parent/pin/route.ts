import { NextResponse } from 'next/server';
import { PARENT_COOKIE, checkPasscode } from '@/lib/auth';

export async function POST(req: Request) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  const token = await checkPasscode('parent', String(pin ?? ''));
  if (!token) return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARENT_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 });
  return res;
}
