import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { parseBody, deliveryFixedSchedulePostSchema } from '@/lib/api/schemas';
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

  const list = await prisma.driverFixedSchedule.findMany({
    where: driverId ? { driverId } : undefined,
    orderBy: [{ driverId: 'asc' }, { dayOfWeek: 'asc' }],
    select: {
      id: true,
      driverId: true,
      dayOfWeek: true,
      createdAt: true,
      driver: {
        select: { id: true, userId: true, name: true },
      },
    },
  });
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

  const parsed = await parseBody(request, deliveryFixedSchedulePostSchema);
  if ('error' in parsed) return parsed.error;
  const { driverId, dayOfWeek } = parsed.data;

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { id: true },
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 400 });
  }

  const created = await prisma.driverFixedSchedule.upsert({
    where: {
      driverId_dayOfWeek: { driverId, dayOfWeek },
    },
    create: { driverId, dayOfWeek },
    update: {},
    select: {
      id: true,
      driverId: true,
      dayOfWeek: true,
      createdAt: true,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driverId');
  const dayOfWeek = searchParams.get('dayOfWeek');
  if (!driverId || dayOfWeek === null || dayOfWeek === '') {
    return NextResponse.json(
      { error: 'driverId and dayOfWeek are required' },
      { status: 400 },
    );
  }
  const dow = parseInt(dayOfWeek, 10);
  if (Number.isNaN(dow) || dow < 0 || dow > 6) {
    return NextResponse.json(
      { error: 'dayOfWeek must be 0-6' },
      { status: 400 },
    );
  }

  await prisma.driverFixedSchedule.deleteMany({
    where: { driverId, dayOfWeek: dow },
  });
  return NextResponse.json({ ok: true });
}
