'use client';

import { formatCurrency } from '@/lib/utils';

type RevenueSummaryProps = {
  totalRevenue: number;
  targetRevenue: number;
};

function RevenueSummary({ totalRevenue, targetRevenue }: RevenueSummaryProps) {
  return (
    <div className="w-full flex flex-col justify-center gap-3">
      <div className="w-full flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Total Revenue</p>
          <p className="text-muted-foreground mt-2 text-sm">Target</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold tabular-nums">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-muted-foreground mt-1 text-base tabular-nums">
            -{/* {formatCurrency(targetRevenue)} */}
          </p>
        </div>
      </div>
    </div>
  );
}

export default RevenueSummary;
