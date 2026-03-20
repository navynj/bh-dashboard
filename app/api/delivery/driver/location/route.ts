/**
 * POST /api/delivery/driver/location
 * Auth: Bearer driver JWT. Body: { lat, lng }. Records GPS update for office tracking.
 */

import { verifyDriverToken } from '@/lib/delivery/driver-auth';
import { parseBody, deliveryDriverLocationPostSchema } from '@/lib/api/schemas';
import { prisma } from '@/lib/core/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const payload = verifyDriverToken(authHeader);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseBody(request, deliveryDriverLocationPostSchema);
  if ('error' in parsed) return parsed.error;
  const { lat, lng } = parsed.data;

  await prisma.driverLocationUpdate.create({
    data: { driverId: payload.driverId, lat, lng },
  });

  return NextResponse.json({ ok: true });
}
