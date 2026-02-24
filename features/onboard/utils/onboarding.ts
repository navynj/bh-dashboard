import { prisma } from '@/lib/core/prisma';
import { UserRole } from '@prisma/client';

export type PendingUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  location: string | null;
};

export async function getPendingApprovals(): Promise<PendingUser[]> {
  const roles = Object.values(UserRole).filter((r) => r !== 'admin');

  const users = await prisma.user.findMany({
    where: {
      status: 'pending_approval',
      ...{ role: { in: roles } },
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
