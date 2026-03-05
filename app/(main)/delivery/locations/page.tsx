import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { DeliveryLocationsContent } from '@/features/delivery/components/DeliveryLocationsContent';
import type { DeliveryLocationRow } from '@/features/delivery/types/locations';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default async function DeliveryLocationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth');
  if (!getOfficeOrAdmin(session.user.role)) redirect('/auth');

  const headersList = await headers();
  const cookie = headersList.get('cookie') ?? '';

  const [locRes, mainLocRes] = await Promise.all([
    fetch(`${baseUrl}/api/delivery/location`, {
      headers: { cookie },
      cache: 'no-store',
    }),
    fetch(`${baseUrl}/api/location`, {
      headers: { cookie },
      cache: 'no-store',
    }),
  ]);

  if (!locRes.ok) {
    return (
      <div className="text-destructive py-4">
        Failed to load delivery locations.
      </div>
    );
  }

  const locations: DeliveryLocationRow[] = await locRes.json();
  let locationOptions: { id: string; code: string; name: string }[] = [];
  if (mainLocRes.ok) {
    const mainList = await mainLocRes.json();
    locationOptions = Array.isArray(mainList)
      ? mainList.map((l: { id: string; code: string; name: string }) => ({
          id: l.id,
          code: l.code,
          name: l.name,
        }))
      : [];
  }

  return (
    <DeliveryLocationsContent
      locations={locations}
      locationOptions={locationOptions}
    />
  );
}
