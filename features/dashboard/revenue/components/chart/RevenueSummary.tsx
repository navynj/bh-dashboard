'use client';

import { formatCurrency } from '@/lib/utils';

type RevenueSummaryProps = {
  totalRevenue: number;
  targetRevenue: number;
};

function RevenueSummary({ totalRevenue, targetRevenue }: RevenueSummaryProps) {
  const noTarget =
    !Number.isFinite(targetRevenue) || targetRevenue <= 0;
  return (
    <div className="text-2xl font-semibold">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-normal">Total Revenue</p>
          <p className="text-muted-foreground text-base font-normal">
            {noTarget ? 'No target set' : 'Target'}
          </p>
        </div>
        <div className="inline-flex flex-col items-end">
          <p className="font-extrabold tabular-nums">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-muted-foreground text-base font-normal tabular-nums">
            {noTarget ? '—' : `/${formatCurrency(targetRevenue)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default RevenueSummary;
