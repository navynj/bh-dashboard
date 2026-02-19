'use client';

import ChartPieDonutText from '@/components/chart/DonutChart';
import { ChartSkeleton } from '@/components/features/budget/card/BudgetCardSkeleton';
import { type ChartConfig } from '@/components/ui/chart';
import { CHART_COLORS } from '@/constants/color';
import {
  cn,
  formatCurrency,
  isTopLevelCategory,
  getTopLevelCategoryIndex,
  getTopLevelCategories,
} from '@/lib/utils';
import { ClassName } from '@/types/className';

interface TotalBudgetChartProps extends ClassName {
  totalAmount: number; // Budget total; all chart percentages are share of budget
  currentCosByCategory?: { categoryId: string; name: string; amount: number }[];
  /** When <= 0, no reference income: show current COS only (100% = current COS total). */
  referencePeriodMonthsUsed?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

const TotalBudgetChart = ({
  size = 'md',
  totalAmount,
  currentCosByCategory,
  referencePeriodMonthsUsed,
  className,
}: TotalBudgetChartProps) => {
  const hasValidBudget = Number.isFinite(totalAmount) && totalAmount > 0;
  const noReference =
    referencePeriodMonthsUsed != null && referencePeriodMonthsUsed <= 0;
  const cosOnlyMode = noReference;
  const currentCosSum = (currentCosByCategory ?? []).reduce((s, c) => s + c.amount, 0);
  const hasNoChartData =
    !currentCosByCategory?.length ||
    (!cosOnlyMode && (!Number.isFinite(totalAmount) || totalAmount <= 0)) ||
    (cosOnlyMode && currentCosSum <= 0);

  if (hasNoChartData) {
    return hasValidBudget ? (
      <ChartSkeleton
        className={cn(
          size === 'sm'
            ? 'max-h-[150px]'
            : size === 'md'
              ? 'max-h-[300px]'
              : 'max-h-[400px]',
          className,
        )}
      />
    ) : null;
  }

  const topLevelCategories = getTopLevelCategories(currentCosByCategory);

  if (topLevelCategories.length === 0) {
    return (
      <ChartSkeleton
        className={cn(
          size === 'sm'
            ? 'max-h-[150px]'
            : size === 'md'
              ? 'max-h-[300px]'
              : 'max-h-[400px]',
          className,
        )}
      />
    );
  }

  const currentAmount = topLevelCategories.reduce((sum, c) => sum + c.cos, 0);

  let categoryData: { category: string; amount: number; cos: number; fill: string }[];
  let currentPercent: string;
  let chartData: { category: string; amount: number; cos: number; fill: string }[];

  if (cosOnlyMode) {
    // No reference: 100% = current COS total; segments = category share of current COS
    const totalCos = currentAmount > 0 ? currentAmount : 1;
    categoryData = topLevelCategories.map((category, index) => ({
      category: category.category,
      amount: category.cos,
      cos: Number(((category.cos / totalCos) * 100).toFixed(2)),
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
    currentPercent = '100';
    chartData = categoryData;
  } else {
    // Normal: percentages are share of budget
    categoryData = topLevelCategories.map((category, index) => ({
      category: category.category,
      amount: category.cos,
      cos: Number(((category.cos / totalAmount) * 100).toFixed(2)),
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
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
    (config, category, index) => {
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
      className={cn(
        className,
        size === 'sm'
          ? 'max-h-[150px]'
          : size === 'md'
            ? 'max-h-[300px]'
            : 'max-h-[400px]',
      )}
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
