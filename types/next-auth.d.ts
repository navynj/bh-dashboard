import type { UserRole, UserStatus } from '@prisma/client';

declare module 'next-auth' {
  interface JWT {
    id?: string;
    role?: UserRole | null;
    status?: UserStatus;
    locationId?: string | null;
    locationCode?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole | null;
      status: UserStatus;
      locationId: string | null;
      locationCode: string | null;
    };
  }
}

declare module '@auth/core/adapters' {
  interface AdapterUser {
    role?: UserRole | null;
    status?: UserStatus;
    locationId?: string | null;
  }
}
