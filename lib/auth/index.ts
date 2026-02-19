import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/core/prisma';
import type { UserStatus } from '@prisma/client';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    redirect({ url, baseUrl }) {
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
          session.user.rejectReason = dbUser.rejectReason ?? null;
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
  useSecureCookies: process.env.NODE_ENV === 'production',
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

export function getOfficeOrAdmin(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'office';
}
