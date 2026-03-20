/**
 * GET /api/delivery/driver/schedule?date=YYYY-MM-DD
 * Auth: Authorization: Bearer <driver JWT>
 * Returns today's schedule (stops + tasks) for the authenticated driver.
 */

import { verifyDriverToken } from '@/lib/delivery/driver-auth';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[schedule] GET', request.url);
  const authHeader = request.headers.get('authorization');
  const payload = verifyDriverToken(authHeader);
  if (!payload) {
    console.log('[schedule] Unauthorized: no or invalid Bearer token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log('[schedule] driverId', payload.driverId);

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  if (!dateStr) {
    return NextResponse.json(
      { error: 'Query param date is required (YYYY-MM-DD)' },
      { status: 400 },
    );
  }
  const dateOnly = new Date(dateStr + 'Z');
  if (Number.isNaN(dateOnly.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const stops = await prisma.dailyScheduleStop.findMany({
    where: { date: dateOnly, driverId: payload.driverId },
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      date: true,
      driverId: true,
      sequence: true,
      name: true,
      address: true,
      lat: true,
      lng: true,
      arrivedAt: true,
      departedAt: true,
      tasks: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          sequence: true,
          title: true,
          completedAt: true,
          isDismissed: true,
        },
      },
    },
  });
  console.log('[schedule] stops count', stops.length);

  return NextResponse.json({
    date: dateStr,
    driverId: payload.driverId,
    stops,
  });
}
