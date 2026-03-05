'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DeliveryNav = () => {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    pathname === path || pathname.startsWith(path + '/') ? '' : 'text-gray-300';

  return (
    <nav className="flex flex-col max-sm:flex-row flex-wrap gap-4 pb-2 mb-4 font-extrabold text-lg">
      <Link
        href="/delivery/overview"
        className={linkClass('/delivery/overview')}
      >
        Overview
      </Link>
      <Link href="/delivery/drivers" className={linkClass('/delivery/drivers')}>
        Drivers
      </Link>
      <Link
        href="/delivery/locations"
        className={linkClass('/delivery/locations')}
      >
        Locations
      </Link>
    </nav>
  );
};

export default DeliveryNav;
