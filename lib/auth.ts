import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { UserStatus } from '@prisma/client';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // Link to existing user by email so the same Google account always signs in as the same user.
      // Only enable if you trust Google’s email verification (e.g. org accounts).
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    redirect({ url, baseUrl }) {
      // After sign-in, redirect to callbackUrl (e.g. /). Same-origin only so cookie is sent.
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return baseUrl;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { location: true },
        });
        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.status = dbUser.status;
          session.user.locationId = dbUser.locationId;
          session.user.locationCode = dbUser.location?.code ?? null;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth',
  },
  session: { strategy: 'jwt' },
  trustHost: true,
  // Required for session cookie to be set on localhost (HTTP). Omit in production (HTTPS).
  useSecureCookies: process.env.NODE_ENV === 'production',
  // Force cookie options in development so the browser accepts the session cookie on localhost.
  // Use the same host as in the address bar (localhost or 127.0.0.1) or the cookie may not be sent.
  ...(process.env.NODE_ENV !== 'production' && {
    cookies: {
      sessionToken: {
        name: 'authjs.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: false,
        },
      },
      callbackUrl: {
        name: 'authjs.callback-url',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: false,
        },
      },
      csrfToken: {
        name: 'authjs.csrf-token',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: false,
        },
      },
    },
  }),
});

export function requireActiveSession(
  session: { user: { status: UserStatus } } | null,
) {
  if (!session?.user) return false;
  return session.user.status === 'active';
}

export function requireOnboardingComplete(
  session: { user: { status: UserStatus } } | null,
) {
  if (!session?.user) return false;
  return session.user.status !== 'pending_onboarding';
}

export function canSetBudget(
  role: string | null | undefined,
): boolean {
  return role === 'admin' || role === 'office';
}
