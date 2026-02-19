'use client';

import { cn } from '@/lib/utils';
import { ClassName } from '@/types/className';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { Button } from '../ui/button';

const HeaderNav = ({
  className,
  isOfficeOrAdmin,
}: PropsWithChildren<ClassName & { isOfficeOrAdmin: boolean }>) => {
  return (
    <nav
      className={cn(
        'flex items-center flex-wrap md:justify-between gap-2 md:gap-6',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <NavItem href="/budget">Budget</NavItem>
        <NavItem href="https://bhpnl.vercel.app" target="_blank">
          Reports
        </NavItem>
      </div>
      {isOfficeOrAdmin && (
        <div className="flex items-center gap-2">
          <NavItem href="/users">Users</NavItem>
          <NavItem href="/locations">Locations</NavItem>
        </div>
      )}
    </nav>
  );
};

const NavItem = ({
  href,
  children,
  target,
}: PropsWithChildren<ClassName & { href: string; target?: string }>) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'opacity-50 hover:opacity-70',
      )}
      asChild
    >
      <Link href={href} target={target}>
        {children}
      </Link>
    </Button>
  );
};

export default HeaderNav;
