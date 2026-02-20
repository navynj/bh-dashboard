/**
 * Server-side helper to get QuickBooks connection status for the current user.
 * Used by the report location page and shares logic with GET /api/quickbooks/connection.
 */

const ACCESS_TOKEN_BUFFER_MS = 5 * 60 * 1000;

import { getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';

export type RealmConnectionItem = {
  locationId: string;
  locationCode: string;
  locationName: string | null;
  classId: string | null;
  realmId: string | null;
  qbRealmId: string | null;
  realmName: string | null;
  hasTokens: boolean;
  refreshExpiresAt: string | null;
  accessTokenExpired: boolean;
  refreshTokenExpired: boolean;
};

type SessionLike = {
  user: { id: string; role?: string | null; locationId?: string | null };
};

export async function getConnections(
  session: SessionLike | null,
): Promise<RealmConnectionItem[]> {
  if (!session?.user?.id) return [];

  const isOfficeOrAdmin = getOfficeOrAdmin(session.user.role);
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
      name: true,
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

  return locations.map((loc) => {
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
      locationName: loc.name ?? null,
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
}
