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

  const locations = await prisma.location.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      classId: true,
    },
    orderBy: { code: 'asc' },
  });

  return NextResponse.json(locations);
}
