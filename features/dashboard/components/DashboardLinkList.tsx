'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DashboardLinkList = () => {
  const pathname = usePathname();
  const linkClass = (path: string) =>
    pathname === path || pathname.startsWith(path + '/') ? '' : 'text-gray-300';
  return (
    <>
      <Link
        href="/dashboard/revenue"
        className={linkClass('/dashboard/revenue')}
      >
        Revenue
      </Link>
      <Link href="/dashboard/budget" className={linkClass('/dashboard/budget')}>
        Budget
      </Link>
      <Link href="/dashboard/labor" className={linkClass('/dashboard/labor')}>
        Labor
      </Link>
    </>
  );
};

export default DashboardLinkList;
