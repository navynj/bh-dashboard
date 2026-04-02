'use client';

import { Location } from '@prisma/client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const LocationLinkItem = ({ location }: { location: Location }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString()
    ? '?' + searchParams.toString()
    : '';

  const linkClass = (path: string) =>
    pathname === path ||
    pathname.startsWith(`/dashboard/location/${location.id}`)
      ? ''
      : 'text-gray-300';
  return (
    <Link
      href={`/dashboard/location/${location.id}${queryString}`}
      className={linkClass(`/dashboard/location/${location.id}`)}
    >
      {location.code}
    </Link>
  );
};

export default LocationLinkItem;
