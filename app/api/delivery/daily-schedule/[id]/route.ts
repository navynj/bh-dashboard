import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  parseBody,
  deliveryDailySchedulePatchSchema,
} from '@/lib/api/schemas';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { parseScheduleId } from '../route';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = parseScheduleId(id);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid schedule id' }, { status: 400 });
  }
  const { dateStr, driverId } = parsed;
  const dateOnly = new Date(dateStr + 'Z');
  if (Number.isNaN(dateOnly.getTime())) {
    return NextResponse.json({ error: 'Invalid date in schedule id' }, { status: 400 });
  }

  const stops = await prisma.dailyScheduleStop.findMany({
    where: { date: dateOnly, driverId },
    orderBy: { sequence: 'asc' },
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
      createdAt: true,
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

  if (stops.length === 0) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, userId: true, name: true },
    });
    if (!driver) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    return NextResponse.json({
      id,
      date: dateStr,
      driverId,
      createdAt: null,
      updatedAt: null,
      driver,
      stops: [],
    });
  }

  const first = stops[0];
  const schedule = {
    id,
    date: dateStr,
    driverId,
    createdAt: first.createdAt,
    updatedAt: first.createdAt,
    driver: first.driver,
    stops,
  };
  return NextResponse.json(schedule);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = parseScheduleId(id);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid schedule id' }, { status: 400 });
  }
  const { dateStr, driverId } = parsed;
  const dateOnly = new Date(dateStr + 'Z');
  if (Number.isNaN(dateOnly.getTime())) {
    return NextResponse.json({ error: 'Invalid date in schedule id' }, { status: 400 });
  }

  const body = await parseBody(request, deliveryDailySchedulePatchSchema);
  if ('error' in body) return body.error;
  const { stops } = body.data;

  if (stops && stops.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.dailyScheduleTask.deleteMany({
        where: { dailyScheduleStop: { date: dateOnly, driverId } },
      });
      await tx.dailyScheduleStop.deleteMany({
        where: { date: dateOnly, driverId },
      });
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
                assignedById: session.user?.id ?? null,
                assignedAt: new Date(),
              })),
            },
          },
        });
      }
    });
  } else {
    await prisma.dailyScheduleTask.deleteMany({
      where: { dailyScheduleStop: { date: dateOnly, driverId } },
    });
    await prisma.dailyScheduleStop.deleteMany({
      where: { date: dateOnly, driverId },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = parseScheduleId(id);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid schedule id' }, { status: 400 });
  }
  const { dateStr, driverId } = parsed;
  const dateOnly = new Date(dateStr + 'Z');
  if (Number.isNaN(dateOnly.getTime())) {
    return NextResponse.json({ error: 'Invalid date in schedule id' }, { status: 400 });
  }

  await prisma.dailyScheduleTask.deleteMany({
    where: { dailyScheduleStop: { date: dateOnly, driverId } },
  });
  await prisma.dailyScheduleStop.deleteMany({
    where: { date: dateOnly, driverId },
  });
  return NextResponse.json({ ok: true });
}
