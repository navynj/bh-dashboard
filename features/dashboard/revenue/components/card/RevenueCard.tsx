import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RevenuePeriodData } from '../types';
import MonthlyRevenueCard from './MonthlyRevenueCard';
import WeeklyRevenueCard from './WeeklyRevenueCard';

type RevenueCardProps = {
  locationId: string;
  yearMonth: string;
  monthlyRevenue: RevenuePeriodData;
  weeklyRevenue: RevenuePeriodData;
  initialWeekOffset: number;
};

const RevenueCard = ({
  locationId,
  yearMonth,
  monthlyRevenue,
  weeklyRevenue,
  initialWeekOffset,
}: RevenueCardProps) => {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="w-full text-xl font-bold">Revenue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* <WeeklyRevenueCard
          key={yearMonth}
          locationId={locationId}
          yearMonth={yearMonth}
          initialData={weeklyRevenue}
          initialWeekOffset={initialWeekOffset}
        /> */}
        <MonthlyRevenueCard data={monthlyRevenue} />
      </CardContent>
    </Card>
  );
};

export default RevenueCard;
