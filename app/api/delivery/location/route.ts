import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { parseBody, deliveryLocationPostSchema } from '@/lib/api/schemas';
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

  const list = await prisma.deliveryLocation.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      address: true,
      lat: true,
      lng: true,
      locationId: true,
      createdAt: true,
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

  const parsed = await parseBody(request, deliveryLocationPostSchema);
  if ('error' in parsed) return parsed.error;
  const { name, address, lat, lng, locationId } = parsed.data;

  const created = await prisma.deliveryLocation.create({
    data: {
      name,
      address: address ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      locationId: locationId ?? null,
    },
    select: {
      id: true,
      name: true,
      address: true,
      lat: true,
      lng: true,
      locationId: true,
      createdAt: true,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
