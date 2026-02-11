import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import React from 'react';
import SignOutButton from '../features/auth/SignOutButton';
import Link from 'next/link';

const Header = async () => {
  const session = await auth();
  if (!session?.user) redirect('/auth');

  const isActive = session.user.status === 'active';
  return (
    isActive && (
      <header className="flex items-center justify-between border-b pb-6 mb-5">
        <div className="flex items-center gap-6">
          <div>
            <Link href="/budget">
              <h1 className="text-xl font-semibold">BH Budget</h1>
            </Link>
            <p className="text-muted-foreground text-sm">
              {session.user.name ?? session.user.email}
              {session.user.role && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                  {session.user.role}
                </span>
              )}
              {session.user.locationCode && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                  {session.user.locationCode}
                </span>
              )}
            </p>
          </div>
        </div>
        <SignOutButton size="sm" />
      </header>
    )
  );
};

export default Header;
