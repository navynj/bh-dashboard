import { parseBody, userPatchSchema } from '@/lib/api/schemas';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { NextResponse } from 'next/server';

export async function PATCH(
  _request: Request,
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
  const parsed = await parseBody(_request, userPatchSchema);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const updateData: {
    name?: string | null;
    role?: 'admin' | 'office' | 'manager';
    status?: 'pending_onboarding' | 'pending_approval' | 'active' | 'rejected';
    locationId?: string | null;
  } = {};
  if (body.name !== undefined) updateData.name = body.name || null;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.locationId !== undefined) updateData.locationId = body.locationId ?? null;

  await prisma.user.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}
