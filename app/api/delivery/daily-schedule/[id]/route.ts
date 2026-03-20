import type { Prisma } from '@prisma/client';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  parseBody,
  deliveryDailySchedulePatchSchema,
} from '@/lib/api/schemas';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { parseScheduleId } from '../route';

type PatchStopTask = { id?: string; title: string };

/** Update task rows in place so completedAt / isDismissed / arrival state on the stop are preserved. */
async function syncDailyStopTasks(
  tx: Prisma.TransactionClient,
  stopId: string,
  payloadTasks: PatchStopTask[],
  officeUserId: string | null,
) {
  const existing = await tx.dailyScheduleTask.findMany({
    where: { dailyScheduleStopId: stopId },
  });
  const existingById = new Map(existing.map((t) => [t.id, t]));
  const incomingIds = new Set(
    payloadTasks.map((t) => t.id).filter((id): id is string => Boolean(id)),
  );

  for (const t of existing) {
    if (!incomingIds.has(t.id)) {
      await tx.dailyScheduleTask.delete({ where: { id: t.id } });
    }
  }

  for (let ti = 0; ti < payloadTasks.length; ti++) {
    const pt = payloadTasks[ti];
    if (pt.id && existingById.has(pt.id)) {
      await tx.dailyScheduleTask.update({
        where: { id: pt.id },
        data: { sequence: ti, title: pt.title },
      });
    } else {
      await tx.dailyScheduleTask.create({
        data: {
          dailyScheduleStopId: stopId,
          sequence: ti,
          title: pt.title,
          assignedById: officeUserId,
          assignedAt: new Date(),
        },
      });
    }
  }
}

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
          isDismissed: true,
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
    const officeUserId = session.user?.id ?? null;
    await prisma.$transaction(async (tx) => {
      const payloadStopIds = stops
        .map((s) => s.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      if (payloadStopIds.length > 0) {
        await tx.dailyScheduleStop.deleteMany({
          where: {
            date: dateOnly,
            driverId,
            id: { notIn: payloadStopIds },
          },
        });
      } else {
        await tx.dailyScheduleTask.deleteMany({
          where: { dailyScheduleStop: { date: dateOnly, driverId } },
        });
        await tx.dailyScheduleStop.deleteMany({
          where: { date: dateOnly, driverId },
        });
      }

      for (let idx = 0; idx < stops.length; idx++) {
        const s = stops[idx];
        const existing =
          s.id != null && s.id.length > 0
            ? await tx.dailyScheduleStop.findFirst({
                where: { id: s.id, date: dateOnly, driverId },
              })
            : null;

        if (existing) {
          await tx.dailyScheduleStop.update({
            where: { id: s.id! },
            data: {
              sequence: idx,
              deliveryLocationId: s.deliveryLocationId ?? null,
              name: s.name,
              ...(s.address !== undefined
                ? { address: s.address ?? null }
                : {}),
              ...(s.lat !== undefined ? { lat: s.lat ?? null } : {}),
              ...(s.lng !== undefined ? { lng: s.lng ?? null } : {}),
            },
          });
          await syncDailyStopTasks(
            tx,
            s.id!,
            s.tasks ?? [],
            officeUserId,
          );
        } else {
          const created = await tx.dailyScheduleStop.create({
            data: {
              date: dateOnly,
              driverId,
              sequence: idx,
              deliveryLocationId: s.deliveryLocationId ?? null,
              name: s.name,
              address: s.address ?? null,
              lat: s.lat ?? null,
              lng: s.lng ?? null,
            },
          });
          await syncDailyStopTasks(
            tx,
            created.id,
            s.tasks ?? [],
            officeUserId,
          );
        }
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
