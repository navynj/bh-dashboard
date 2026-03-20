/**
 * POST /api/delivery/driver/[id]/request-location
 * Auth: office/admin session. Asks the driver app to send a fresh GPS fix as soon as possible.
 */

import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: driverId } = await params;
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { id: true },
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  await prisma.driver.update({
    where: { id: driverId },
    data: { locationPingRequestedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
