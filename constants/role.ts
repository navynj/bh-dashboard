import { UserRole } from '@prisma/client';

export const ROLES: { value: UserRole; label: string }[] = Object.values(
  UserRole,
).map((role) => ({
  value: role,
  label: role,
}));
