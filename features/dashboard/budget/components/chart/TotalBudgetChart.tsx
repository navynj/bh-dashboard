'use client';

import ChartPieDonutText from '@/components/chart/DonutChart';
import { ChartSkeleton } from '@/features/dashboard/budget/components/card/BudgetCardSkeleton';
import { type ChartConfig } from '@/components/ui/chart';
import { CHART_COLORS } from '@/constants/color';
import { cn, formatCurrency } from '@/lib/utils';
import {
  getTopLevelCategories,
  getTopLevelCategoriesForCharts,
  getTopLevelCategoriesTopLevelOnly,
} from '@/features/report/utils/category';
import { ClassName } from '@/types/className';

function donutSizeClassName(
  size: 'sm' | 'md' | 'lg',
  className: string | undefined,
) {
  return cn(
    className,
    size === 'sm'
      ? 'max-h-[150px]'
      : size === 'md'
        ? 'max-h-[300px]'
        : 'max-h-[400px]',
  );
}

/** Full-ring muted donut for “no cost data yet” (not loading). */
function BlankBudgetDonut({
  size,
  className,
}: {
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const chartData = [
    {
      category: 'Empty',
      cos: 100,
      amount: 0,
      fill: 'var(--muted)',
    },
  ];
  const chartConfig = {
    Empty: {
      label: ' ',
      color: 'var(--muted)',
    },
  };
  return (
    <ChartPieDonutText
      className={donutSizeClassName(size, className)}
      strokeWidth={size === 'sm' ? 3 : size === 'md' ? 5 : 7}
      innerRadius={size === 'sm' ? 40 : size === 'md' ? 70 : 100}
      title="0%"
      description="Cost of Sales"
      chartData={chartData}
      dataKey="cos"
      nameKey="category"
      chartConfig={chartConfig}
      tooltipFormatter={() => null}
    />
  );
}

interface TotalBudgetChartProps extends ClassName {
  totalAmount: number; // Budget total; all chart percentages are share of budget
  currentCosByCategory?: { categoryId: string; name: string; amount: number }[];
  /** Reference COS (unused for donut slices; current month is shown from QB current only). */
  referenceCosByCategory?: {
    categoryId: string;
    name: string;
    amount: number;
  }[];
  /** When <= 0, no reference income: show current COS only (100% = current COS total). */
  referencePeriodMonthsUsed?: number | null;
  size?: 'sm' | 'md' | 'lg';
  /** While chart data is refreshing (e.g. after budget update), show skeleton instead of empty donut. */
  isChartLoading?: boolean;
}

const TotalBudgetChart = ({
  size = 'md',
  totalAmount,
  currentCosByCategory,
  referenceCosByCategory,
  referencePeriodMonthsUsed,
  className,
  isChartLoading = false,
}: TotalBudgetChartProps) => {
  const hasValidBudget = Number.isFinite(totalAmount) && totalAmount > 0;
  const noReference =
    referencePeriodMonthsUsed != null && referencePeriodMonthsUsed <= 0;
  const cosOnlyMode = noReference;
  const currentCosSum = (currentCosByCategory ?? []).reduce(
    (s, c) => s + c.amount,
    0,
  );
  const hasNoChartData =
    !currentCosByCategory?.length ||
    (!cosOnlyMode && (!Number.isFinite(totalAmount) || totalAmount <= 0)) ||
    (cosOnlyMode && currentCosSum <= 0);

  if (hasNoChartData) {
    if (!hasValidBudget) return null;
    return isChartLoading ? (
      <ChartSkeleton className={donutSizeClassName(size, className)} />
    ) : (
      <BlankBudgetDonut size={size} className={className} />
    );
  }

  // Current month QB only (no reference union) so slices match P&L / category list
  const forCharts = getTopLevelCategoriesForCharts(currentCosByCategory, []);
  const topLevelCategories =
    forCharts.length > 0
      ? forCharts.map((r) => ({ category: r.name, cos: r.amount }))
      : getTopLevelCategories(currentCosByCategory);

  if (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_DEBUG_COS === 'true'
  ) {
    console.log(
      '[DEBUG_COS] currentCosByCategory',
      JSON.stringify(currentCosByCategory ?? [], null, 2),
    );
    console.log(
      '[DEBUG_COS] referenceCosByCategory',
      JSON.stringify(referenceCosByCategory ?? [], null, 2),
    );
    console.log(
      '[DEBUG_COS] forCharts (merged top-level)',
      JSON.stringify(forCharts, null, 2),
    );
    console.log(
      '[DEBUG_COS] topLevelCategories (donut)',
      JSON.stringify(topLevelCategories, null, 2),
    );
  }

  if (topLevelCategories.length === 0) {
    return isChartLoading ? (
      <ChartSkeleton className={donutSizeClassName(size, className)} />
    ) : (
      <BlankBudgetDonut size={size} className={className} />
    );
  }

  type TopLevelItem = { category: string; cos: number };
  const currentAmount = topLevelCategories.reduce(
    (sum: number, c: TopLevelItem) => sum + c.cos,
    0,
  );

  let categoryData: {
    category: string;
    amount: number;
    cos: number;
    fill: string;
  }[];
  let currentPercent: string;
  let chartData: {
    category: string;
    amount: number;
    cos: number;
    fill: string;
  }[];

  if (cosOnlyMode) {
    // No reference: 100% = current COS total; segments = category share of current COS
    const totalCos = currentAmount > 0 ? currentAmount : 1;
    categoryData = topLevelCategories.map(
      (category: TopLevelItem, index: number) => ({
        category: category.category,
        amount: category.cos,
        cos: Number(((category.cos / totalCos) * 100).toFixed(2)),
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }),
    );
    currentPercent = '100';
    chartData = categoryData;
  } else {
    // Normal: percentages are share of budget
    categoryData = topLevelCategories.map(
      (category: TopLevelItem, index: number) => ({
        category: category.category,
        amount: category.cos,
        cos: Number(((category.cos / totalAmount) * 100).toFixed(2)),
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }),
    );
    const currentPercentValue = (currentAmount / totalAmount) * 100;
    currentPercent = currentPercentValue.toFixed(1);
    const isOverBudget = currentAmount > totalAmount;
    const overAmount = isOverBudget ? currentAmount - totalAmount : 0;
    const overPercent = isOverBudget
      ? Number(((overAmount / totalAmount) * 100).toFixed(2))
      : 0;
    const remainingAmount = Math.max(0, totalAmount - currentAmount);
    const remainingPercent = Number(
      ((remainingAmount / totalAmount) * 100).toFixed(2),
    );
    const shouldShowRemaining = !isOverBudget && remainingPercent >= 0.1;
    const shouldShowOver = isOverBudget && overPercent >= 0.1;
    chartData = [
      ...categoryData,
      ...(shouldShowRemaining
        ? [
            {
              category: 'Remaining',
              amount: remainingAmount,
              cos: remainingPercent,
              fill: 'var(--muted-background)',
            },
          ]
        : []),
      ...(shouldShowOver
        ? [
            {
              category: 'Over',
              amount: overAmount,
              cos: overPercent,
              fill: 'var(--destructive)',
            },
          ]
        : []),
    ];
  }

  // ===============================
  // Chart Config
  // ===============================
  const chartConfig = topLevelCategories.reduce<ChartConfig>(
    (config: ChartConfig, category: TopLevelItem, index: number) => {
      config[category.category] = {
        label: category.category,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
      return config;
    },
    {
      Remaining: {
        label: 'Remaining',
        color: 'var(--muted)',
      },
      Over: {
        label: 'Over',
        color: 'var(--destructive)',
      },
    },
  );

  return (
    <ChartPieDonutText
      className={donutSizeClassName(size, className)}
      strokeWidth={size === 'sm' ? 3 : size === 'md' ? 5 : 7}
      innerRadius={size === 'sm' ? 40 : size === 'md' ? 70 : 100}
      title={`${currentPercent}%`}
      description={`Cost of Sales`}
      chartData={chartData}
      dataKey="cos"
      nameKey="category"
      chartConfig={chartConfig}
      tooltipFormatter={(value, name, payload) => {
        const amount = Number(payload.amount ?? 0);
        const percent = typeof value === 'number' ? value : Number(value);
        const fillColor =
          typeof payload.fill === 'string' ? payload.fill : 'var(--muted)';
        return (
          <>
            <span className="flex items-center gap-1.5 text-muted-foreground">
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
};

export default TotalBudgetChart;
