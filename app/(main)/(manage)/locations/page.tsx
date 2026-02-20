import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { LocationsContent } from './LocationsContent';
import type { RealmWithConnection } from '@/app/api/realm/route';

type LocationRow = {
  id: string;
  code: string;
  name: string;
  classId: string | null;
  realmId: string;
  realmName: string | null;
  startYearMonth: string | null;
  showBudget: boolean;
};

export default async function LocationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth');
  }
  if (!getOfficeOrAdmin(session.user.role)) {
    redirect('/auth');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'http://localhost:3000';
  const headersList = await headers();
  const cookie = headersList.get('cookie') ?? '';

  const [realmRes, locationRes] = await Promise.all([
    fetch(`${baseUrl}/api/realm`, {
      headers: { cookie },
      cache: 'no-store',
    }),
    fetch(`${baseUrl}/api/location`, {
      headers: { cookie },
      cache: 'no-store',
    }),
  ]);

  if (!realmRes.ok || !locationRes.ok) {
    return (
      <div className="text-destructive py-4">
        Failed to load data. You may not have permission.
      </div>
    );
  }

  const realmData = await realmRes.json();
  const locations: LocationRow[] = await locationRes.json();

  const realms: RealmWithConnection[] = Array.isArray(realmData.realms)
    ? realmData.realms
    : [];
  const isAdmin = Boolean(realmData.isAdmin);

  return (
    <LocationsContent
      realms={realms}
      isAdmin={isAdmin}
      locations={locations}
    />
  );
}
