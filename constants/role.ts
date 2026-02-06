import { UserRole } from '@prisma/client';

export const ROLES: { value: UserRole; label: string }[] = [
  { value: 'manager', label: 'Manager (view own location only)' },
  { value: 'office', label: 'Office (set budget, view all locations)' },
  { value: 'admin', label: 'Admin (developer, full config)' },
];
