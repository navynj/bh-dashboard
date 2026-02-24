'use client';

import Link from 'next/link';
import { Button } from '../ui/button';
import { PropsWithChildren } from 'react';
import { ClassName } from '@/types/className';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const HeaderNavItem = ({
  href,
  children,
  target,
}: PropsWithChildren<ClassName & { href: string; target?: string }>) => {
  'use client';
  const pathname = usePathname();
  const isActive = pathname.includes(href);
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

export default HeaderNavItem;
