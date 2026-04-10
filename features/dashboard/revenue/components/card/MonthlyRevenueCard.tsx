'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
import RevenueShareBarChart from '../chart/RevenueShareBarChart';
import RevenueSummary from '../chart/RevenueSummary';
import RevenueCategoryList from '../list/RevenueCategoryList';
import type { RevenuePeriodData } from '../types';

type MonthlyRevenueCardProps = {
  data: RevenuePeriodData;
  className?: string;
};

const MonthlyRevenueCard = ({ data, className }: MonthlyRevenueCardProps) => {
  return (
    <Card className={cn('min-w-0 overflow-hidden gap-2', className)}>
      <CardHeader>
        <CardTitle className="text-base font-bold flex items-center justify-between">
          <p>Monthly Revenue</p>
          <p className="font-extrabold tabular-nums text-2xl">
            {formatCurrency(data.totalRevenue)}
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <RevenueShareBarChart categories={data.categories} />
      </CardContent>
    </Card>
  );
};

export default MonthlyRevenueCard;
