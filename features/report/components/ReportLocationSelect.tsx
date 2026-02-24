import Link from 'next/link';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RealmConnectionItem } from '@/lib/quickbooks/connections';

type ReportLocationSelectProps = {
  connections: RealmConnectionItem[];
};

export function ReportLocationSelect({ connections }: ReportLocationSelectProps) {
  const connectionsWithTokens = connections.filter((c) => c.hasTokens);

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">P&L Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select a location to generate and view Profit & Loss reports. Reports
          are stored in Notion.
        </p>
      </div>

      {connectionsWithTokens.length === 0 ? (
        <p className="text-muted-foreground">
          No locations with QuickBooks connected. Connect QuickBooks for a
          location to generate P&L reports.
        </p>
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-4 min-w-0 sm:grid-cols-2 lg:grid-cols-3',
            '[&>*]:min-w-0',
          )}
        >
          {connectionsWithTokens.map((c) => (
            <Link
              key={c.locationId}
              href={`/report/location/${c.locationId}`}
              className={cn(
                'flex items-center gap-4 rounded-lg border p-4',
                'bg-card text-card-foreground shadow-sm',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{c.locationCode}</p>
                <p className="text-sm text-muted-foreground">
                  {c.locationName}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
