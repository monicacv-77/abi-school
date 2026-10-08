import { NextResponse } from 'next/server';
import { APP_COOKIE, checkPasscode } from '@/lib/auth';

export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  const token = await checkPasscode('app', String(passcode ?? ''));
  if (!token) return NextResponse.json({ error: 'Wrong passcode' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(APP_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 60 });
  return res;
}
