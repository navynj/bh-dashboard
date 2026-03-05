import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  parseBody,
  deliveryFixedScheduleTemplatePutSchema,
} from '@/lib/api/schemas';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driverId');
  const dayOfWeekStr = searchParams.get('dayOfWeek');
  if (!driverId || dayOfWeekStr === null || dayOfWeekStr === '') {
    return NextResponse.json(
      { error: 'driverId and dayOfWeek are required' },
      { status: 400 },
    );
  }
  const dayOfWeek = parseInt(dayOfWeekStr, 10);
  if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json(
      { error: 'dayOfWeek must be 0-6' },
      { status: 400 },
    );
  }

  const fixed = await prisma.driverFixedSchedule.findUnique({
    where: { driverId_dayOfWeek: { driverId, dayOfWeek } },
    select: {
      id: true,
      templateStops: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          sequence: true,
          deliveryLocationId: true,
          name: true,
          address: true,
          lat: true,
          lng: true,
          deliveryLocation: {
            select: { id: true, name: true, address: true },
          },
          tasks: {
            orderBy: { sequence: 'asc' },
            select: { id: true, sequence: true, title: true },
          },
        },
      },
    },
  });

  if (!fixed) {
    return NextResponse.json(
      { error: 'Fixed schedule not found for this driver and day' },
      { status: 404 },
    );
  }

  const stops = fixed.templateStops.map((s) => ({
    id: s.id,
    sequence: s.sequence,
    deliveryLocationId: s.deliveryLocationId,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    deliveryLocation: s.deliveryLocation,
    tasks: s.tasks.map((t) => ({ id: t.id, sequence: t.sequence, title: t.title })),
  }));

  return NextResponse.json({ id: fixed.id, stops });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = await parseBody(request, deliveryFixedScheduleTemplatePutSchema);
  if ('error' in parsed) return parsed.error;
  const { driverId, dayOfWeek, stops } = parsed.data;

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { id: true },
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 400 });
  }

  const fixed = await prisma.driverFixedSchedule.upsert({
    where: { driverId_dayOfWeek: { driverId, dayOfWeek } },
    create: { driverId, dayOfWeek },
    update: {},
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.fixedScheduleTask.deleteMany({
      where: { fixedScheduleStop: { fixedScheduleId: fixed.id } },
    });
    await tx.fixedScheduleStop.deleteMany({
      where: { fixedScheduleId: fixed.id },
    });
    if (stops.length > 0) {
      for (let idx = 0; idx < stops.length; idx++) {
        const s = stops[idx];
        const stop = await tx.fixedScheduleStop.create({
          data: {
            fixedScheduleId: fixed.id,
            sequence: idx,
            deliveryLocationId: s.deliveryLocationId ?? null,
            name: s.name.trim(),
            address: s.address?.trim() ?? null,
            lat: s.lat ?? null,
            lng: s.lng ?? null,
          },
          select: { id: true },
        });
        const taskTitles = (s.tasks ?? []).filter((t) => t.title.trim());
        if (taskTitles.length > 0) {
          await tx.fixedScheduleTask.createMany({
            data: taskTitles.map((t, tidx) => ({
              fixedScheduleStopId: stop.id,
              sequence: tidx,
              title: t.title.trim(),
            })),
          });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
