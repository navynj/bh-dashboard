'use client';

import type { ReactNode } from 'react';
import { Label, Pie, PieChart } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

interface DonutChartProps {
  className?: string;
  title?: string;
  description?: string;
  chartData: Array<Record<string, string | number>>;
  dataKey: string;
  nameKey: string;
  chartConfig: ChartConfig;
  innerRadius?: number;
  strokeWidth?: number;
  startAngle?: number;
  endAngle?: number;
  tooltipUnit?: string;
  tooltipFormatter?: (
    value: string | number,
    name: string,
    payload: Record<string, string | number>,
  ) => ReactNode;
  cx?: number;
  cy?: number;
}

const ChartPieDonutText = ({
  className,
  title,
  description,
  chartData,
  dataKey,
  nameKey,
  chartConfig,
  innerRadius = 60,
  strokeWidth = 5,
  startAngle = 90,
  endAngle = -270,
  tooltipUnit,
  tooltipFormatter,
  cx,
  cy,
}: DonutChartProps) => {
  return (
    <ChartContainer
      config={chartConfig}
      className={cn(
        // min size: Recharts 3 ResponsiveContainer renders nothing until width/height are positive;
        // flex parents (e.g. dashboard cards) often collapse to 0 without min-w/min-h.
        'mx-auto aspect-square w-full min-h-[220px] min-w-[220px] shrink-0 max-h-[250px]',
        className ?? '',
      )}
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name, item) => {
                const payload =
                  item &&
                  typeof item === 'object' &&
                  'payload' in item
                    ? (item as { payload?: unknown }).payload
                    : undefined;
                return tooltipFormatter ? (
                  tooltipFormatter(
                    typeof value === 'number' || typeof value === 'string'
                      ? value
                      : String(value),
                    String(name),
                    (payload as Record<string, string | number>) ?? {},
                  )
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {String(name ?? '')}
                    </span>
                    <span className="text-foreground ml-2 font-mono font-medium tabular-nums">
                      {typeof value === 'number'
                        ? value.toLocaleString()
                        : String(value ?? '')}
                      {tooltipUnit ?? ''}
                    </span>
                  </>
                );
              }}
            />
          }
        />
        <Pie
          data={chartData}
          dataKey={dataKey}
          nameKey={nameKey}
          innerRadius={innerRadius}
          strokeWidth={strokeWidth}
          startAngle={startAngle}
          endAngle={endAngle}
          cx={cx}
          cy={cy}
        >
          {(title || description) && (
            <Label
              content={({ viewBox }) => {
                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-3xl font-bold"
                      >
                        {title}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 24}
                        className="fill-muted-foreground"
                      >
                        {description}
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          )}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};

export default ChartPieDonutText;
