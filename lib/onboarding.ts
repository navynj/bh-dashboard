import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

export type PendingUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  location: string | null;
};

export async function getPendingApprovals(
  approverRole: UserRole,
): Promise<PendingUser[]> {
  const users = await prisma.user.findMany({
    where: {
      status: 'pending_approval',
      ...(approverRole === 'office'
        ? { role: 'manager' }
        : { role: { in: ['office', 'manager'] } }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      location: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name ?? '',
    email: u.email ?? '',
    role: u.role!,
    location: u.location ? `${u.location.code} – ${u.location.name}` : null,
  }));
}
