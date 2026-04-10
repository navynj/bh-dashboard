'use client';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  usePlotArea,
} from 'recharts';
import type { ScatterShapeProps } from 'recharts';
import { createContext, useContext } from 'react';
import type { CloverDayHourlyStat } from '../types';

/** Business window 06:00–22:00 inclusive (local). */
const HOUR_START = 6;
const HOUR_END = 22;
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START + 1 },
  (_, i) => i + HOUR_START,
);
const HOUR_COUNT = HOURS.length;

/** e.g. 6 → "06:00", 22 → "22:00" */
function fmtHour24(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** Bucket label for tooltips: "09:00–10:00" … "22:00–23:00" */
function fmtHourRangeLabel(h: number): string {
  const start = fmtHour24(h);
  const end = fmtHour24(h + 1);
  return `${start}–${end}`;
}

/** Upper bound for weekly bar chart Y domain (headroom above max bar). */
function weeklyBarYMax(maxTotal: number): number {
  if (!Number.isFinite(maxTotal) || maxTotal <= 0) return 1;
  return maxTotal * 1.1;
}

/** Emerald-500 heat scale (Tailwind-aligned rgb) */
function heatFill(intensity: number): string {
  if (intensity <= 0) return 'transparent';
  const alpha = (0.08 + intensity * 0.87).toFixed(3);
  return `rgba(16,185,129,${alpha})`;
}

type CellDatum = {
  hour: number;
  dayIndex: number;
  dayLabel: string;
  date: string;
  revenue: number;
  transactionCount: number;
};

const HeatmapMetaContext = createContext({
  maxRevenue: 0,
  rowCount: 1,
  hourCount: HOUR_COUNT,
});

/**
 * Recharts 3: pass shape as a React element (not a bare function) so this stays
 * a proper component and `usePlotArea` works — Customized no longer receives axis maps.
 */
function HeatmapCell(props: Partial<ScatterShapeProps>) {
  const { maxRevenue, rowCount, hourCount } = useContext(HeatmapMetaContext);
  const plot = usePlotArea();
  const cell = (props.payload ?? props) as CellDatum;
  if (props.cx == null || props.cy == null || !plot || rowCount < 1 || hourCount < 1)
    return null;

  const cellW = Math.max(2, plot.width / hourCount - 2.5);
  const cellH = Math.max(2, plot.height / rowCount - 2);
  const intensity = maxRevenue > 0 ? cell.revenue / maxRevenue : 0;

  return (
    <rect
      x={props.cx - cellW / 2}
      y={props.cy - cellH / 2}
      width={cellW}
      height={cellH}
      rx={3}
      fill={heatFill(intensity)}
      stroke="hsl(var(--border))"
      strokeWidth={0.5}
      vectorEffect="non-scaling-stroke"
      style={{ strokeOpacity: 0.35 }}
    />
  );
}

function HeatTooltipBody({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as CellDatum | undefined;
  if (!d || d.revenue === 0) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-lg text-xs space-y-0.5">
      <p className="font-semibold text-foreground">
        {format(parseISO(d.date), 'EEE, MMM d')} · {fmtHourRangeLabel(d.hour)}
      </p>
      <p className="text-muted-foreground">
        Revenue:{' '}
        <span className="font-medium text-foreground tabular-nums">
          {formatCurrency(d.revenue)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Transactions:{' '}
        <span className="font-medium text-foreground tabular-nums">
          {d.transactionCount}
        </span>
      </p>
    </div>
  );
}

const weeklyBarChartConfig = {
  total: {
    label: 'Revenue (week)',
    color: 'rgb(16, 185, 129)',
  },
} satisfies ChartConfig;

type HourlySalesHeatmapProps = {
  dayHourlySales: CloverDayHourlyStat[];
  weekDates: { date: string; label: string }[];
};

export default function HourlySalesHeatmap({
  dayHourlySales,
  weekDates,
}: HourlySalesHeatmapProps) {
  if (weekDates.length === 0) return null;

  const lookup = new Map<string, Map<number, { revenue: number; count: number }>>();
  for (const row of dayHourlySales) {
    let hm = lookup.get(row.date);
    if (!hm) {
      hm = new Map();
      lookup.set(row.date, hm);
    }
    hm.set(row.hour, { revenue: row.revenue, count: row.transactionCount });
  }

  let maxRevenue = 0;
  for (const { date } of weekDates) {
    const hm = lookup.get(date);
    if (!hm) continue;
    for (const h of HOURS) {
      const v = hm.get(h);
      if (v && v.revenue > maxRevenue) maxRevenue = v.revenue;
    }
  }

  const cells: CellDatum[] = weekDates.flatMap(({ date, label }, dayIndex) =>
    HOURS.map((hour) => {
      const v = lookup.get(date)?.get(hour);
      return {
        hour,
        dayIndex,
        dayLabel: label,
        date,
        revenue: v?.revenue ?? 0,
        transactionCount: v?.count ?? 0,
      };
    }),
  );

  const dayLabels = weekDates.map((d) => d.label);
  const rowCount = weekDates.length;

  const hourTotals = HOURS.map((h) =>
    weekDates.reduce((s, { date }) => s + (lookup.get(date)?.get(h)?.revenue ?? 0), 0),
  );

  const barData = HOURS.map((h, i) => ({
    hour: h,
    hourLabel: fmtHour24(h),
    slotLabel: fmtHourRangeLabel(h),
    total: hourTotals[i] ?? 0,
  }));

  const maxBarTotal = Math.max(0, ...barData.map((d) => d.total));
  const yMax = weeklyBarYMax(maxBarTotal);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">Hourly Heatmap</span>
        <span className="text-xs text-muted-foreground">
          Recharts · 06:00–22:00 (local) · green = higher revenue
        </span>
      </div>

      <HeatmapMetaContext.Provider
        value={{ maxRevenue, rowCount, hourCount: HOUR_COUNT }}
      >
        <ChartContainer
          config={{}}
          className="w-full"
          style={{ height: `${rowCount * 32 + 84}px` }}
        >
          <ScatterChart margin={{ top: 8, right: 4, bottom: 36, left: 32 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.4}
              vertical={false}
            />
            <XAxis
              type="number"
              dataKey="hour"
              domain={[HOUR_START - 0.5, HOUR_END + 0.5]}
              ticks={HOURS}
              tickFormatter={fmtHour24}
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
              angle={-55}
              textAnchor="end"
              height={36}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="dayIndex"
              domain={[-0.5, rowCount - 0.5]}
              ticks={weekDates.map((_, i) => i)}
              tickFormatter={(i: number) => dayLabels[i] ?? ''}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              reversed
              width={30}
            />
            <Tooltip content={HeatTooltipBody} cursor={false} />
            <Scatter
              data={cells}
              dataKey="hour"
              shape={<HeatmapCell />}
              isAnimationActive={false}
              legendType="none"
            />
          </ScatterChart>
        </ChartContainer>
      </HeatmapMetaContext.Provider>

      <div className="space-y-1 pl-[28px] pr-0.5 min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground">
          Weekly total per hour (06:00–22:00, local)
        </p>
        <ChartContainer
          config={weeklyBarChartConfig}
          className="h-[200px] w-full min-h-[200px] max-w-none aspect-auto"
        >
          <BarChart
            accessibilityLayer
            data={barData}
            margin={{ top: 8, right: 4, bottom: 36, left: 4 }}
          >
            <XAxis
              dataKey="hourLabel"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
              angle={-55}
              textAnchor="end"
              height={48}
            />
            <YAxis
              domain={[0, yMax]}
              tickCount={6}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={44}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n) || n === 0) return '$0';
                if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
                return formatCurrency(n);
              }}
            />
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <ChartTooltip
              cursor={{ fill: 'rgba(0, 0, 0, 0.06)' }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) => {
                    const first = payload?.[0] as
                      | { payload?: { slotLabel?: string } }
                      | undefined;
                    return first?.payload?.slotLabel ?? '';
                  }}
                  formatter={(value) => (
                    <span className="font-mono font-medium tabular-nums">
                      {formatCurrency(Number(value))}
                    </span>
                  )}
                />
              }
            />
            <Bar
              dataKey="total"
              fill="var(--color-total)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
