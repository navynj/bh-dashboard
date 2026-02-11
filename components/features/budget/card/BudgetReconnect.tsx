import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ReconnectContent = ({
  locationId,
  showButton = true,
}: {
  locationId: string;
  showButton?: boolean;
}) => {
  return (
    <div className="h-full flex flex-col gap-2 items-center justify-center rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm">
      <p className="font-medium">QuickBooks connection expired.</p>
      {showButton && (
        <Button
          asChild
          variant="destructive"
          size="sm"
          className="w-full max-w-3xs"
        >
          <a
            href={`/api/quickbook/connect?locationId=${encodeURIComponent(locationId)}`}
          >
            Reconnect QuickBooks
          </a>
        </Button>
      )}
    </div>
  );
};

const ReconnectOnlyCard = ({
  locationId,
  locationCode,
  locationName,
}: {
  locationId: string;
  locationCode?: string | null;
  locationName?: string | null;
}) => {
  const locationLabel = locationCode ?? locationName ?? 'Location';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium">
          {locationLabel} Budget
        </CardTitle>
      </CardHeader>
      <CardContent className="h-full">
        <ReconnectContent locationId={locationId} />
      </CardContent>
    </Card>
  );
};

export { ReconnectOnlyCard, ReconnectContent };
