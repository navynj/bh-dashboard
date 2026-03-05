import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { parseBody, deliveryLocationPatchSchema } from '@/lib/api/schemas';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';

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
  const parsed = await parseBody(request, deliveryLocationPatchSchema);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;

  const existing = await prisma.deliveryLocation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Delivery location not found' }, { status: 404 });
  }

  const updateData: {
    name?: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    locationId?: string | null;
  } = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.address !== undefined) updateData.address = body.address ?? null;
  if (body.lat !== undefined) updateData.lat = body.lat ?? null;
  if (body.lng !== undefined) updateData.lng = body.lng ?? null;
  if (body.locationId !== undefined) updateData.locationId = body.locationId ?? null;

  await prisma.deliveryLocation.update({
    where: { id },
    data: updateData,
  });
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
  await prisma.deliveryLocation.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
