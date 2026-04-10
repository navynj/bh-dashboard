'use client';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { CHART_COLORS } from '@/constants/color';
import { cn, formatCurrency } from '@/lib/utils';
import { Bar, BarChart, BarStack, XAxis, YAxis } from 'recharts';
import type { RevenueCategoryItem } from '../types';

type RevenueShareBarChartProps = {
  categories: RevenueCategoryItem[];
  className?: string;
};

function segmentKey(index: number): string {
  return `seg_${index}`;
}

export default function RevenueShareBarChart({
  categories,
  className,
}: RevenueShareBarChartProps) {
  const total = categories.reduce((s, c) => s + c.amount, 0);

  const segments = categories.map((c, index) => ({
    key: segmentKey(index),
    name: c.name,
    amount: c.amount,
    share: total > 0 ? (c.amount / total) * 100 : 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (segments.length === 0 || total <= 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex min-h-[3.5rem] items-center justify-center rounded-lg border border-dashed text-sm px-4',
          className,
        )}
      >
        No data for this period.
      </div>
    );
  }

  const chartRow: Record<string, string | number> = { y: 'mix' };
  for (const s of segments) {
    chartRow[s.key] = s.amount;
  }
  const chartData = [chartRow];

  const chartConfig = segments.reduce<ChartConfig>((acc, s) => {
    acc[s.key] = { label: s.name, color: s.color };
    return acc;
  }, {});

  return (
    <ChartContainer
      config={chartConfig}
      className={cn(
        'h-14 w-full max-w-none aspect-auto min-h-14 min-w-0',
        className,
      )}
    >
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        barCategoryGap={0}
      >
        <XAxis type="number" domain={[0, total]} hide />
        <YAxis type="category" dataKey="y" width={0} hide />
        <ChartTooltip
          cursor={{ fill: 'rgba(0, 0, 0, 0.06)' }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => {
                const raw = item as {
                  dataKey?: string | number;
                  payload?: Record<string, unknown>;
                };
                const dataKey = String(raw.dataKey ?? '');
                const seg = segments.find((s) => s.key === dataKey);
                const amount = Number(
                  value ?? raw.payload?.[dataKey] ?? 0,
                );
                const pct = total > 0 ? (amount / total) * 100 : 0;
                const label = seg?.name ?? dataKey;
                const fillColor = seg?.color ?? 'var(--muted)';
                return (
                  <>
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: fillColor }}
                      />
                      <span>{label}</span>
                    </span>
                    <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
                      {formatCurrency(amount)}
                      <span className="text-muted-foreground ml-1 text-[11px]">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </>
                );
              }}
            />
          }
        />
        <BarStack stackId="revenue" radius={6}>
          {segments.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={s.color}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
          ))}
        </BarStack>
      </BarChart>
    </ChartContainer>
  );
}
