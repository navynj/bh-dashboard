import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  parseBody,
  deliveryDailyScheduleFromFixedPostSchema,
} from '@/lib/api/schemas';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = await parseBody(request, deliveryDailyScheduleFromFixedPostSchema);
  if ('error' in parsed) return parsed.error;
  const { date } = parsed.data;

  const dateOnly = new Date(date + 'Z');
  if (Number.isNaN(dateOnly.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  const dayOfWeek = dateOnly.getUTCDay();

  const fixedWithTemplates = await prisma.driverFixedSchedule.findMany({
    where: { dayOfWeek },
    select: {
      id: true,
      driverId: true,
      templateStops: {
        orderBy: { sequence: 'asc' },
        select: {
          sequence: true,
          deliveryLocationId: true,
          name: true,
          address: true,
          lat: true,
          lng: true,
          tasks: {
            orderBy: { sequence: 'asc' },
            select: { title: true },
          },
        },
      },
    },
  });

  const existingStops = await prisma.dailyScheduleStop.findMany({
    where: { date: dateOnly },
    select: { driverId: true },
    distinct: ['driverId'],
  });
  const existingDriverIds = new Set(existingStops.map((e) => e.driverId));

  const assignedById = session.user.id;
  const assignedAt = new Date();
  const created: { driverId: string }[] = [];

  for (const fixed of fixedWithTemplates) {
    if (existingDriverIds.has(fixed.driverId)) continue;
    const templateStops = fixed.templateStops.filter((s) => s.name.trim());
    if (templateStops.length === 0) continue;

    for (let idx = 0; idx < templateStops.length; idx++) {
      const s = templateStops[idx];
      await prisma.dailyScheduleStop.create({
        data: {
          date: dateOnly,
          driverId: fixed.driverId,
          sequence: idx,
          deliveryLocationId: s.deliveryLocationId ?? null,
          name: s.name,
          address: s.address ?? null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          tasks: {
            create: (s.tasks ?? [])
              .filter((t) => t.title.trim())
              .map((t, tidx) => ({
                sequence: tidx,
                title: t.title.trim(),
                assignedById,
                assignedAt,
              })),
          },
        },
      });
    }
    created.push({ driverId: fixed.driverId });
    existingDriverIds.add(fixed.driverId);
  }

  return NextResponse.json({ created: created.length, schedules: created });
}
