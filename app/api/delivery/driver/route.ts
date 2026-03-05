import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { parseBody, deliveryDriverPostSchema } from '@/lib/api/schemas';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const list = await prisma.driver.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      name: true,
      createdAt: true,
    },
  });
  const userIds = list.map((d) => d.userId).filter(Boolean);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const rows = list.map((d) => ({
    id: d.id,
    userId: d.userId,
    name: d.name ?? userMap[d.userId]?.name ?? null,
    email: userMap[d.userId]?.email ?? null,
    createdAt: d.createdAt,
  }));
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = await parseBody(request, deliveryDriverPostSchema);
  if ('error' in parsed) return parsed.error;
  const { userId, name } = parsed.data;

  const existing = await prisma.driver.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'This user is already registered as a driver' },
      { status: 400 },
    );
  }

  const created = await prisma.driver.create({
    data: { userId, name: name ?? null },
    select: {
      id: true,
      userId: true,
      name: true,
      createdAt: true,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
