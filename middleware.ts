import { NextResponse, type NextRequest } from 'next/server';
import { APP_COOKIE, PARENT_COOKIE, appToken, parentToken } from './lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) return NextResponse.next();

  const token = await appToken();
  if (!token || req.cookies.get(APP_COOKIE)?.value !== token) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'locked' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/parent') || pathname.startsWith('/api/parent')) {
    if (pathname === '/parent/pin' || pathname === '/api/parent/pin') return NextResponse.next();
    const pt = await parentToken();
    if (!pt || req.cookies.get(PARENT_COOKIE)?.value !== pt) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'parent pin required' }, { status: 401 });
      const url = req.nextUrl.clone();
      url.pathname = '/parent/pin';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
