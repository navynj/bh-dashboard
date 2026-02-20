import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { getConnections } from '@/lib/quickbooks/connections';
import { redirect } from 'next/navigation';
import { ReportLocationSelect } from '@/components/features/report/ReportLocationSelect';

/**
 * /report — Office/Admin: show Location Select Cards.
 * Managers: redirect to /report/location/[theirLocationId].
 */
export default async function ReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth');
  }

  const isOfficeOrAdmin = getOfficeOrAdmin(session.user.role);
  const managerLocationId = session.user.locationId ?? undefined;

  if (!isOfficeOrAdmin && managerLocationId) {
    redirect(`/report/location/${managerLocationId}`);
  }

  const connections = await getConnections(session);
  return <ReportLocationSelect connections={connections} />;
}
