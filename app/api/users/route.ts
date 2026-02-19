import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      locationId: true,
      location: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name ?? '',
      email: u.email ?? '',
      role: u.role,
      status: u.status,
      locationId: u.locationId,
      location: u.location
        ? { id: u.location.id, code: u.location.code, name: u.location.name }
        : null,
    }))
  );
}
