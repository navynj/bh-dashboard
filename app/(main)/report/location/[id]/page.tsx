import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { getConnections } from '@/lib/quickbooks/connections';
import { getReportsFromNotion } from '@/lib/report/notion/reports';
import { ReportFormSection } from '@/components/features/report/ReportFormSection';
import { ReportTable } from '@/components/features/report/ReportTable';

export default async function ReportLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: locationId } = await params;

  const session = await auth();
  const isOfficeOrAdmin = getOfficeOrAdmin(session?.user?.role);

  const connections = await getConnections(session ?? null);
  const connection =
    connections.find((c) => c.locationId === locationId) ?? null;

  if (!locationId) {
    return (
      <div className="container max-w-5xl mx-auto py-6">
        <p className="text-muted-foreground">Invalid location.</p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="container max-w-5xl mx-auto py-6">
        <p className="text-muted-foreground">Location not found.</p>
      </div>
    );
  }

  if (!connection.hasTokens) {
    return (
      <div className="container max-w-5xl mx-auto py-6">
        <p className="text-muted-foreground">
          QuickBooks is not connected for this location. Connect QuickBooks to
          generate P&L reports.
        </p>
      </div>
    );
  }

  const reports = session?.user?.id
    ? await getReportsFromNotion(session.user.id, connection.locationCode)
    : [];

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">P&L Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {connection.realmName ?? connection.locationCode} — Generate and view
          Profit & Loss reports. Reports are stored in Notion.
        </p>
      </div>

      <div className="space-y-4">
        <ReportFormSection
          locationCode={connection.locationCode}
          showForm={isOfficeOrAdmin ?? false}
        />
        <ReportTable reports={reports} isOfficeOrAdmin={isOfficeOrAdmin} />
      </div>
    </div>
  );
}
