'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DashboardLinkList = () => {
  const pathname = usePathname();
  const linkClass = (path: string) =>
    pathname === path || pathname.startsWith(path + '/') ? '' : 'text-gray-300';
  const costPathActive =
    pathname === '/dashboard/cost' || pathname.startsWith('/dashboard/cost/');
  return (
    <>
      {/* <Link
        href="/dashboard/revenue"
        className={linkClass('/dashboard/revenue')}
      >
        Revenue
      </Link> */}
      <Link
        href="/dashboard/cost"
        className={costPathActive ? '' : 'text-gray-300'}
      >
        Cost
      </Link>
      {/* <Link href="/dashboard/labor" className={linkClass('/dashboard/labor')}>
        Labor
      </Link> */}
    </>
  );
};

export default DashboardLinkList;
