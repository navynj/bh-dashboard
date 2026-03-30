'use client';

import { ChartBarStacked } from '@/components/chart/BarStackedChart';
import type { ChartConfig } from '@/components/ui/chart';
import { CHART_COLORS } from '@/constants/color';
import { formatCurrency } from '@/lib/utils';
import { useMemo } from 'react';
import type { RevenueDailyBarRow } from '../types';

type RevenueDailyBarChartProps = {
  rows: RevenueDailyBarRow[];
  /** Top-level category ids; same keys as each `row.segments`. */
  segmentKeys: string[];
  /** Display label per key (same length as `segmentKeys`). */
  segmentLabels: string[];
  className?: string;
};

function RevenueDailyBarChart({
  rows,
  segmentKeys,
  segmentLabels,
  className,
}: RevenueDailyBarChartProps) {
  const chartConfig = useMemo(() => {
    return segmentKeys.reduce<ChartConfig>((acc, key, i) => {
      acc[key] = {
        label: segmentLabels[i] ?? key,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
      return acc;
    }, {});
  }, [segmentKeys, segmentLabels]);

  const chartData = useMemo(
    () =>
      rows.map((r) => {
        const row: Record<string, string | number> = {
          label: r.label,
          total: r.total,
        };
        for (const key of segmentKeys) {
          row[key] = r.segments[key] ?? 0;
        }
        return row;
      }),
    [rows, segmentKeys],
  );

  const tooltipExtraRows = useMemo(
    () => (payload: Record<string, unknown>) => {
      const dailyTotal = segmentKeys.reduce(
        (sum, key) => sum + Number(payload[key] ?? 0),
        0,
      );
      return [
        {
          dataKey: 'dailyTotal',
          name: 'Total',
          value: dailyTotal,
        },
      ];
    },
    [segmentKeys],
  );

  if (segmentKeys.length === 0 || rows.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <ChartBarStacked
        chartData={chartData}
        chartConfig={chartConfig}
        className="aspect-[16/7] min-h-[200px] w-full max-w-none"
        tooltipExtraRows={tooltipExtraRows}
        hideTooltipIndicatorForKeys={['dailyTotal']}
      />
    </div>
  );
}

export default RevenueDailyBarChart;
