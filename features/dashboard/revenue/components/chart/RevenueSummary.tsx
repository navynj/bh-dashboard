'use client';

import { formatCurrency } from '@/lib/utils';

type RevenueSummaryProps = {
  totalRevenue: number;
};

function RevenueSummary({ totalRevenue }: RevenueSummaryProps) {
  return (
    <div className="text-2xl font-semibold">
      <div className="flex items-center justify-between">
        <p className="text-base font-normal">Total Revenue</p>
        <p className="font-extrabold tabular-nums">
          {formatCurrency(totalRevenue)}
        </p>
      </div>
    </div>
  );
}

export default RevenueSummary;
