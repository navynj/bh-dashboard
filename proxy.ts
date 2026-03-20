import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { UserStatus } from '@prisma/client';

const UNAUTHORIZED_PATHS = ['/auth', '/onboarding', '/waiting'];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Not a user yet -> auth
  if (!session?.user) {
    if (pathname.startsWith('/auth')) return NextResponse.next();
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  const status: UserStatus = session.user.status ?? 'pending_onboarding';

  // Not onboarded -> onboarding
  if (status === 'pending_onboarding') {
    if (pathname === '/onboarding' || pathname.startsWith('/api/onboarding'))
      return NextResponse.next();
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  // Not approved -> waiting
  if (status === 'pending_approval') {
    if (pathname === '/waiting') return NextResponse.next();
    return NextResponse.redirect(new URL('/waiting', req.url));
  }

  if (UNAUTHORIZED_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Exclude static assets, next-auth, and driver app API routes (Bearer token auth, no session).
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/delivery/driver-auth|api/delivery/driver/schedule|api/delivery/driver/location|api/delivery/daily-schedule/stop|api/delivery/daily-schedule/task|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
