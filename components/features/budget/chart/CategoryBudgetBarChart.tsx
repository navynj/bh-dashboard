'use client';

import { ChartBarStacked } from '@/components/chart/BarStackedChart';
import { ChartConfig } from '@/components/ui/chart';
import { CHART_COLORS } from '@/constants/color';
import { getTopLevelCategoryIndex, isTopLevelCategory } from '@/lib/utils';
import { ClassName } from '@/types/className';

type CosCategory = { categoryId: string; name: string; amount: number };

interface CategoryBudgetBarChartProps extends ClassName {
  totalBudget: number;
  currentCosByCategory?: CosCategory[];
  /** Reference-period COS (N months before yearMonth) for category budget ratio. */
  referenceCosByCategory?: CosCategory[];
  referenceCosTotal?: number;
  /** When <= 0, no reference: show current COS only (no budget/over segments). */
  referencePeriodMonthsUsed?: number | null;
  chartConfig?: ChartConfig;
}

/** Top-level categories only, sorted by category index. */
function getTopLevelCategoryRows(categories: CosCategory[]): CosCategory[] {
  return [...categories]
    .filter((c) => isTopLevelCategory(c.categoryId))
    .sort(
      (a, b) =>
        getTopLevelCategoryIndex(a.categoryId) -
        getTopLevelCategoryIndex(b.categoryId),
    );
}

const CategoryBudgetBarChart = ({
  totalBudget,
  currentCosByCategory,
  referenceCosByCategory,
  referenceCosTotal,
  referencePeriodMonthsUsed,
  chartConfig,
  className,
}: CategoryBudgetBarChartProps) => {
  const defaultConfig: ChartConfig = {
    current: {
      label: 'Current',
      color: 'hsl(var(--chart-1))',
    },
    budget: {
      label: 'Budget',
      color: 'var(--muted-background)',
    },
    over: {
      label: 'Over',
      color: 'var(--destructive)',
    },
  };

  const config = { ...defaultConfig, ...chartConfig };

  const noReference =
    referencePeriodMonthsUsed != null && referencePeriodMonthsUsed <= 0;
  const cosOnlyMode = noReference;

  const currentTop = getTopLevelCategoryRows(currentCosByCategory ?? []);
  const refTop = referenceCosByCategory
    ? getTopLevelCategoryRows(referenceCosByCategory)
    : [];
  const refTopTotal =
    referenceCosTotal ?? refTop.reduce((s, c) => s + c.amount, 0);
  const currentByCategoryId = new Map(
    currentTop.map((c) => [c.categoryId, c.amount]),
  );
  const rowsToShow =
    refTop.length > 0 && !cosOnlyMode
      ? refTop
      : currentTop;

  const chartData = rowsToShow.map((row, index) => {
    const current = currentByCategoryId.get(row.categoryId) ?? (refTop.length > 0 && !cosOnlyMode ? 0 : row.amount);
    const refCos = refTop.find((r) => r.categoryId === row.categoryId)?.amount ?? 0;
    const categoryBudget =
      !cosOnlyMode && refTopTotal > 0 && totalBudget > 0
        ? (totalBudget * refCos) / refTopTotal
        : 0;

    const currentSeg = cosOnlyMode ? current : Math.min(current, categoryBudget);
    const budgetSeg = cosOnlyMode ? 0 : Math.max(0, categoryBudget - current);
    const overSeg = cosOnlyMode ? 0 : Math.max(0, current - categoryBudget);

    const cosNumReg = /COS(\d+)/;
    const cosNum = row.name.match(cosNumReg)?.[1];
    const label = cosNum ? `COS${cosNum}` : row.name;

    return {
      label,
      fullName: row.name,
      current: Math.round(currentSeg * 100) / 100,
      budget: Math.round(budgetSeg * 100) / 100,
      over: Math.round(overSeg * 100) / 100,
      currentColor: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  const hasData =
    chartData.length > 0 &&
    chartData.some((d) => d.current > 0 || d.budget > 0 || d.over > 0);

  if (!hasData) return null;

  return (
    <ChartBarStacked
      chartData={chartData}
      chartConfig={config}
      rowColorDataKey="current"
      excludeFromLegend={['current']}
      filterTooltipZero
      tooltipValueGetter={(payload, dataKey) => {
        if (dataKey === 'current') {
          const c = Number(payload.current ?? 0);
          const o = Number(payload.over ?? 0);
          return c + o;
        }
        if (dataKey === 'over') return Number(payload.over ?? 0);
        if (dataKey === 'budget') {
          const cur = Number(payload.current ?? 0);
          const rem = Number(payload.budget ?? 0);
          return cur + rem;
        }
        return undefined;
      }}
      tooltipItemColor={(payload, dataKey) =>
        dataKey === 'current' ? (payload.currentColor as string) : undefined
      }
      tooltipNameGetter={(payload, dataKey) =>
        dataKey === 'current' ? (payload.fullName as string) : undefined
      }
      tooltipExtraRows={(p) => {
        const over = Number(p.over ?? 0);
        if (over > 0) return [];
        const totalBudget = Number(p.current ?? 0) + Number(p.budget ?? 0);
        const actualSpending = Number(p.current ?? 0) + Number(p.over ?? 0);
        const remaining = totalBudget - actualSpending;
        if (remaining <= 0) return [];
        return [
          {
            dataKey: 'remaining',
            name: 'Remaining',
            value: Math.round(remaining * 100) / 100,
            color: 'var(--chart-budget)',
          },
        ];
      }}
      tooltipAlwaysShowKeys={['budget']}
      className={className}
    />
  );
};

export default CategoryBudgetBarChart;
