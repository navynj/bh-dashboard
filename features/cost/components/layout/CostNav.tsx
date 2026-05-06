'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/cost/list', labelKey: 'Cost.costs' },
  // { href: '/cost/product', labelKey: 'Product.products' },
];

export default function CostNav() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav className="max-sm:w-full max-sm:p-0 [&>*]:whitespace-nowrap px-2 space-y-2 flex flex-col max-sm:space-y-0 max-sm:flex-row max-sm:items-center max-sm:gap-4 max-sm:text-sm [&>*]:font-extrabold [&>*]:text-lg max-sm:mb-4">
      {NAV_ITEMS.map(({ href, labelKey }) => {
        const isActive =
          pathname.includes(href) ||
          (href === '/cost/list' && pathname === '/cost');
        return (
          <Link
            key={href}
            href={href}
            className={cn(!isActive && 'text-gray-300')}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
