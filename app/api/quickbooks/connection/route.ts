/**
 * GET /api/quickbooks/connection
 * Returns realm connection status for locations the logged-in user can see.
 * Office/Admin: all locations with their realm. Manager: only their location.
 * Includes token expiry so UI can show Refresh (access expired) vs Reconnect (refresh expired).
 */

const ACCESS_TOKEN_BUFFER_MS = 5 * 60 * 1000;

import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { NextResponse } from 'next/server';

export type RealmConnectionItem = {
  /** Used for Connect/Reconnect auth flow. */
  locationId: string;
  /** Location code (e.g. HQ, CC) for reports and display. */
  locationCode: string;
  /** QuickBooks Class ID for this location (e.g. HQ split by class). */
  classId: string | null;
  realmId: string | null;
  qbRealmId: string | null;
  realmName: string | null;
  hasTokens: boolean;
  refreshExpiresAt: string | null;
  /** True if access token is expired or within buffer (use Refresh to get new access token). */
  accessTokenExpired: boolean;
  /** True if refresh token is expired (use Reconnect to get new refresh token). */
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

  const locations = await prisma.location.findMany({
    where: isOfficeOrAdmin
      ? undefined
      : managerLocationId
        ? { id: managerLocationId }
        : { id: 'none' },
    select: {
      id: true,
      code: true,
      realmId: true,
      classId: true,
      realm: {
        select: {
          id: true,
          realmId: true,
          name: true,
          refreshToken: true,
          expiresAt: true,
          refreshExpiresAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const now = Date.now();
  const accessExpiryThreshold = now + ACCESS_TOKEN_BUFFER_MS;

  const connections: RealmConnectionItem[] = locations.map((loc) => {
    const realm = loc.realm;
    const hasTokens = Boolean(realm?.refreshToken);
    const expiresAt = realm?.expiresAt;
    const refreshExpiresAt = realm?.refreshExpiresAt;
    const accessTokenExpired =
      hasTokens &&
      (expiresAt == null || expiresAt.getTime() <= accessExpiryThreshold);
    const refreshTokenExpired =
      hasTokens &&
      refreshExpiresAt != null &&
      new Date(refreshExpiresAt).getTime() < now;

    return {
      locationId: loc.id,
      locationCode: loc.code,
      classId: loc.classId ?? null,
      realmId: realm?.id ?? null,
      qbRealmId: realm?.realmId ?? null,
      realmName: realm?.name ?? null,
      hasTokens,
      refreshExpiresAt: refreshExpiresAt?.toISOString() ?? null,
      accessTokenExpired,
      refreshTokenExpired,
    };
  });

  return NextResponse.json({ connections, isAdmin });
}
