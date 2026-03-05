import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  parseBody,
  deliveryDailySchedulePostSchema,
} from '@/lib/api/schemas';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';

/** Synthetic schedule id for API compatibility: date_driverId (e.g. 2025-03-04_cldriver123) */
export function scheduleIdFrom(dateStr: string, driverId: string): string {
  return `${dateStr}_${driverId}`;
}

export function parseScheduleId(
  id: string
): { dateStr: string; driverId: string } | null {
  const i = id.indexOf('_');
  if (i <= 0 || i === id.length - 1) return null;
  return { dateStr: id.slice(0, i), driverId: id.slice(i + 1) };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const driverIdParam = searchParams.get('driverId');

  if (!dateStr) {
    return NextResponse.json(
      { error: 'Query param date is required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }
  const dateOnly = new Date(dateStr + 'Z');
  if (Number.isNaN(dateOnly.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const where: { date: Date; driverId?: string } = { date: dateOnly };
  if (driverIdParam) where.driverId = driverIdParam;

  const stops = await prisma.dailyScheduleStop.findMany({
    where,
    orderBy: [{ driverId: 'asc' }, { sequence: 'asc' }],
    select: {
      id: true,
      date: true,
      driverId: true,
      sequence: true,
      deliveryLocationId: true,
      name: true,
      address: true,
      lat: true,
      lng: true,
      arrivedAt: true,
      departedAt: true,
      driver: {
        select: { id: true, userId: true, name: true },
      },
      deliveryLocation: {
        select: { id: true, name: true, address: true },
      },
      tasks: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          sequence: true,
          title: true,
          assignedById: true,
          assignedAt: true,
          completedAt: true,
          createdAt: true,
        },
      },
    },
  });

  // Group by driverId into schedule-shaped objects (same shape as before for frontend)
  const byDriver = new Map<
    string,
    {
      id: string;
      date: string;
      driverId: string;
      driver: { id: string; userId: string; name: string | null };
      stops: typeof stops;
    }
  >();
  for (const stop of stops) {
    const did = stop.driverId;
    if (!byDriver.has(did)) {
      byDriver.set(did, {
        id: scheduleIdFrom(dateStr, did),
        date: dateStr,
        driverId: did,
        driver: stop.driver,
        stops: [],
      });
    }
    byDriver.get(did)!.stops.push(stop);
  }

  const list = Array.from(byDriver.values());
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = await parseBody(request, deliveryDailySchedulePostSchema);
  if ('error' in parsed) return parsed.error;
  const { date, driverId, stops } = parsed.data;

  const dateOnly = new Date(date + 'Z');
  if (Number.isNaN(dateOnly.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { id: true, name: true },
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 400 });
  }

  const existingCount = await prisma.dailyScheduleStop.count({
    where: { date: dateOnly, driverId },
  });
  if (existingCount > 0) {
    return NextResponse.json(
      { error: 'Stops already exist for this driver on this date' },
      { status: 400 }
    );
  }

  const assignedById = session.user.id;
  const assignedAt = new Date();

  const createdStops = await prisma.$transaction(async (tx) => {
    const created: { id: string; sequence: number; name: string; address: string | null; tasks: { id: string; title: string; sequence: number }[] }[] = [];
    for (let idx = 0; idx < stops.length; idx++) {
      const s = stops[idx];
      const stop = await tx.dailyScheduleStop.create({
        data: {
          date: dateOnly,
          driverId,
          sequence: idx,
          deliveryLocationId: s.deliveryLocationId ?? null,
          name: s.name,
          address: s.address ?? null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          tasks: {
            create: (s.tasks ?? []).map((t, tidx) => ({
              sequence: tidx,
              title: t.title,
              assignedById,
              assignedAt,
            })),
          },
        },
        select: {
          id: true,
          sequence: true,
          name: true,
          address: true,
          tasks: {
            orderBy: { sequence: 'asc' },
            select: { id: true, title: true, sequence: true },
          },
        },
      });
      created.push(stop);
    }
    return created;
  });

  const schedule = {
    id: scheduleIdFrom(date, driverId),
    date,
    driverId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    driver: { id: driver.id, name: driver.name },
    stops: createdStops,
  };
  return NextResponse.json(schedule, { status: 201 });
}
