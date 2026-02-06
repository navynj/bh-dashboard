import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

const APPROVER_ROLES: UserRole[] = ['admin', 'office'];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (!role || !APPROVER_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required' },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true },
  });

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (target.status !== 'pending_approval') {
    return NextResponse.json(
      { error: 'User is not pending approval' },
      { status: 400 }
    );
  }

  // Office can approve only managers; admin can approve office or manager
  if (role === 'office' && target.role !== 'manager') {
    return NextResponse.json(
      { error: 'Office can only approve managers' },
      { status: 403 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'active',
      permittedById: session.user.id,
      permittedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
