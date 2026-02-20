/**
 * GET /api/realm
 * Returns realm list with QB connection status per realm (connection is per realm, not per location).
 * Office/Admin: all realms. Manager: only realm(s) used by their location(s).
 */
const ACCESS_TOKEN_BUFFER_MS = 5 * 60 * 1000;

import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { NextResponse } from 'next/server';

export type RealmWithConnection = {
  id: string;
  name: string;
  realmId: string;
  hasTokens: boolean;
  refreshExpiresAt: string | null;
  accessTokenExpired: boolean;
  refreshTokenExpired: boolean;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isOfficeOrAdmin = getOfficeOrAdmin(session.user.role);
  const isAdmin = session.user.role === 'admin';
  const managerLocationId = session.user.locationId ?? undefined;

  const realms = await prisma.realm.findMany({
    where: isOfficeOrAdmin
      ? undefined
      : managerLocationId
        ? {
            locations: {
              some: { id: managerLocationId },
            },
          }
        : { id: 'none' },
    select: {
      id: true,
      name: true,
      realmId: true,
      refreshToken: true,
      expiresAt: true,
      refreshExpiresAt: true,
    },
    orderBy: { name: 'asc' },
  });

  const now = Date.now();
  const accessExpiryThreshold = now + ACCESS_TOKEN_BUFFER_MS;

  const realmsWithConnection: RealmWithConnection[] = realms.map((r) => {
    const hasTokens = Boolean(r.refreshToken);
    const expiresAt = r.expiresAt;
    const refreshExpiresAt = r.refreshExpiresAt;
    const accessTokenExpired =
      hasTokens &&
      (expiresAt == null || expiresAt.getTime() <= accessExpiryThreshold);
    const refreshTokenExpired =
      hasTokens &&
      refreshExpiresAt != null &&
      new Date(refreshExpiresAt).getTime() < now;

    return {
      id: r.id,
      name: r.name,
      realmId: r.realmId,
      hasTokens,
      refreshExpiresAt: refreshExpiresAt?.toISOString() ?? null,
      accessTokenExpired,
      refreshTokenExpired,
    };
  });

  return NextResponse.json({ realms: realmsWithConnection, isAdmin });
}
