import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RevenueCard = () => {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold w-full">Labor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Labor for the current month.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueCard;
