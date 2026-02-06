import { auth } from '@/lib/auth';
import { getPendingApprovals } from '@/lib/onboarding';
import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

const APPROVER_ROLES: UserRole[] = ['admin', 'office'];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (!role || !APPROVER_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const list = await getPendingApprovals(role);
  return NextResponse.json(list);
}
