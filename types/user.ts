/**
 * Mirrors `UserRole` / `UserStatus` in `prisma/schema.prisma`.
 * Import from here in **client** components instead of `@prisma/client` so the
 * bundle does not pull Prisma's browser runtime (breaks under Turbopack).
 */
export type UserRole =
  | 'admin'
  | 'office'
  | 'manager'
  | 'supply'
  | 'employee'
  | 'supplier';

export const USER_ROLES: readonly UserRole[] = [
  'admin',
  'office',
  'manager',
  'supply',
  'employee',
  'supplier',
];

export type UserStatus =
  | 'pending_onboarding'
  | 'pending_approval'
  | 'active'
  | 'rejected';

export const USER_STATUSES: readonly UserStatus[] = [
  'pending_onboarding',
  'pending_approval',
  'active',
  'rejected',
];
