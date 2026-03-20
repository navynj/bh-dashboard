/**
 * GET /api/delivery/driver/me/location-ping
 * Auth: Bearer driver JWT. Returns whether the office requested a fresh GPS fix.
 */

import { verifyDriverToken } from '@/lib/delivery/driver-auth';
import { prisma } from '@/lib/core/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const payload = verifyDriverToken(authHeader);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: payload.driverId },
    select: { locationPingRequestedAt: true },
  });

  return NextResponse.json({
    pingRequestedAt: driver?.locationPingRequestedAt?.toISOString() ?? null,
  });
}
