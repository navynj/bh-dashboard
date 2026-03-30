'use client';

import ChartPieDonutText from '@/components/chart/DonutChart';
import type { ChartConfig } from '@/components/ui/chart';
import { CHART_COLORS } from '@/constants/color';
import { formatCurrency } from '@/lib/utils';
import type { RevenueCategoryItem } from '../types';

type RevenueChartProps = {
  categories: RevenueCategoryItem[];
  className?: string;
};

function RevenueChart({ categories, className }: RevenueChartProps) {
  const sumCategories = categories.reduce((s, c) => s + c.amount, 0);
  const denom = sumCategories > 0 ? sumCategories : 1;

  const chartData = categories.map((c, index) => ({
    category: c.name,
    amount: c.amount,
    share: Number(((c.amount / denom) * 100).toFixed(2)),
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (chartData.length === 0 || sumCategories <= 0) {
    return (
      <div
        className={`text-muted-foreground flex min-h-[180px] items-center justify-center rounded-lg border border-dashed text-sm ${className ?? ''}`}
      >
        No category data for this period.
      </div>
    );
  }

  const chartConfig = categories.reduce<ChartConfig>((acc, c, index) => {
    acc[c.name] = {
      label: c.name,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {});

  return (
    <ChartPieDonutText
      className={className ?? 'max-h-[220px]'}
      strokeWidth={5}
      innerRadius={44}
      chartData={chartData}
      dataKey="amount"
      nameKey="category"
      chartConfig={chartConfig}
      tooltipFormatter={(value, name, payload) => {
        const amount = Number(payload.amount ?? value ?? 0);
        const percent = Number(payload.share ?? 0);
        const fillColor =
          typeof payload.fill === 'string' ? payload.fill : 'var(--muted)';
        return (
          <>
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: fillColor }}
              />
              <span>{name}</span>
            </span>
            <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
              {formatCurrency(amount)}
              <span className="text-muted-foreground ml-1 text-[11px]">
                ({percent.toFixed(2)}%)
              </span>
            </span>
          </>
        );
      }}
    />
  );
}

export default RevenueChart;
