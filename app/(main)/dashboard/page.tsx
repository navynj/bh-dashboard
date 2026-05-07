import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { getDefaultDashboardLocationId } from '@/lib/dashboard/default-location';
import { notFound, redirect } from 'next/navigation';

const DashboardPage = async () => {
  const session = await auth();
  const isOfficeOrAdmin = getOfficeOrAdmin(session?.user?.role);

  // Managers have their locationId directly in the session — skip the DB lookup.
  if (!isOfficeOrAdmin && session?.user?.locationId) {
    redirect(`/dashboard/location/${session.user.locationId}`);
  }

  const id = await getDefaultDashboardLocationId();
  if (!id) {
    notFound();
  }
  redirect(`/dashboard/location/${id}`);
};

export default DashboardPage;
