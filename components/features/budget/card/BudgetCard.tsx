import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  BudgetCategoryRow,
  BudgetWithLocationAndCategories,
} from '@/lib/budget';
import { usePathname, useRouter } from 'next/navigation';
import React, { useMemo } from 'react';
import UpdateBudgetButton from './UpdateBudgetButton';
import { ReconnectContent } from './BudgetReconnect';
import BudgetCategoryList from '../category-list/BudgetCategoryList';
import TotalBudgetChart from '../chart/TotalBudgetChart';
import BudgetAmountSummary from '../summary/BudgetAmountSummary';
import Link from 'next/link';
import { ArrowRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import CategoryBudgetBarChart from '../chart/CategoryBudgetBarChart';

/** Derive display categories: merge current month COS with reference so categories with 0 current (e.g. COS5-Liquor) still show. Percent = category amount / Budget total (or current COS total when no reference). */
function deriveDisplayCategories(
  currentCosByCategory:
    | { categoryId: string; name: string; amount: number }[]
    | undefined,
  referenceCosByCategory:
    | { categoryId: string; name: string; amount: number }[]
    | undefined,
  totalBudget: number,
  currentCosTotal?: number,
  noReference?: boolean,
): BudgetCategoryRow[] {
  const currentMap = new Map(
    (currentCosByCategory ?? []).map((c) => [c.categoryId, c]),
  );
  const refList = referenceCosByCategory ?? currentCosByCategory ?? [];
  if (!refList.length) return [];
  const hasBudget = Number.isFinite(totalBudget) && totalBudget > 0;
  const totalForPercent =
    hasBudget ? totalBudget : (noReference && Number.isFinite(currentCosTotal) && (currentCosTotal ?? 0) > 0 ? currentCosTotal! : 0);
  const hasPercent = hasBudget || (noReference && totalForPercent > 0);
  return refList.map((ref) => {
    const current = currentMap.get(ref.categoryId);
    const amount = current?.amount ?? 0;
    return {
      id: ref.categoryId,
      categoryId: ref.categoryId,
      name: ref.name,
      amount,
      percent: hasPercent ? (amount / totalForPercent) * 100 : null,
    };
  });
}

function BudgetCard({
  budget,
  isOfficeOrAdmin,
  yearMonth,
  needsReconnect = false,
  hideChart = false,
}: {
  budget: BudgetWithLocationAndCategories;
  isOfficeOrAdmin: boolean;
  yearMonth: string;
  needsReconnect?: boolean;
  hideChart?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isLocationPage = pathname.includes('/budget/location/');

  const [updating, setUpdating] = React.useState(false);
  const [optimisticRate, setOptimisticRate] = React.useState<number | null>(
    null,
  );
  const [optimisticPeriod, setOptimisticPeriod] = React.useState<number | null>(
    null,
  );

  const totalAmount =
    typeof budget.totalAmount === 'number'
      ? budget.totalAmount
      : Number(budget.totalAmount);
  // Use actual Cost of Sales for this month from QuickBooks when available
  const currentCosTotal =
    typeof budget.currentCosTotal === 'number' &&
    Number.isFinite(budget.currentCosTotal)
      ? budget.currentCosTotal
      : 0;
  const noReference =
    budget.referencePeriodMonthsUsed != null &&
    budget.referencePeriodMonthsUsed <= 0;
  const displayCategories = useMemo(
    () =>
      deriveDisplayCategories(
        budget.currentCosByCategory,
        budget.referenceCosByCategory,
        totalAmount,
        currentCosTotal,
        noReference,
      ),
    [
      budget.currentCosByCategory,
      budget.referenceCosByCategory,
      totalAmount,
      currentCosTotal,
      noReference,
    ],
  );

  const displayRate =
    optimisticRate != null
      ? optimisticRate
      : (budget.budgetRateUsed as number | null);
  const displayPeriod =
    optimisticPeriod != null
      ? optimisticPeriod
      : budget.referencePeriodMonthsUsed;

  const onUpdateStart = React.useCallback((rate?: number, period?: number) => {
    setUpdating(true);
    setOptimisticRate(rate ?? null);
    setOptimisticPeriod(period ?? null);
  }, []);
  const onUpdateSuccess = React.useCallback(() => {
    router.refresh();
    setUpdating(false);
    setOptimisticRate(null);
    setOptimisticPeriod(null);
  }, [router]);
  const onUpdateError = React.useCallback(() => {
    setUpdating(false);
    setOptimisticRate(null);
    setOptimisticPeriod(null);
  }, []);

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold w-full">
          <Link
            href={
              isLocationPage
                ? '#'
                : `/budget/location/${budget.locationId}?yearMonth=${yearMonth}`
            }
            className={cn(
              'group w-full link-underline-anim !flex items-center justify-between gap-2',
              isLocationPage ? 'pointer-events-none' : '',
            )}
          >
            <span>
              {budget.location?.code ??
                budget.location?.name ??
                budget.locationId}
            </span>
            <ArrowRightIcon className="size-4 shrink-0 opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0" />
          </Link>
        </CardTitle>
        {isOfficeOrAdmin && !needsReconnect && (
          <UpdateBudgetButton
            locationId={budget.locationId}
            yearMonth={yearMonth}
            currentBudgetRate={
              typeof budget.budgetRateUsed === 'number'
                ? budget.budgetRateUsed
                : null
            }
            currentReferencePeriodMonths={budget.referencePeriodMonthsUsed}
            onUpdateStart={onUpdateStart}
            onUpdateSuccess={onUpdateSuccess}
            onUpdateError={onUpdateError}
          />
        )}
      </CardHeader>
      <CardContent className="h-full">
        <BudgetAmountSummary
          isUpdating={updating}
          needsReconnect={needsReconnect}
          currentCosTotal={currentCosTotal}
          totalBudget={totalAmount}
          displayRate={displayRate}
          displayPeriod={displayPeriod}
        />
        {!hideChart && (
          <TotalBudgetChart
            totalAmount={totalAmount}
            currentCosByCategory={budget.currentCosByCategory}
            referencePeriodMonthsUsed={budget.referencePeriodMonthsUsed}
          />
        )}
        <BudgetCategoryList
          categories={displayCategories}
          totalBudget={totalAmount}
          currentCosByCategory={budget.currentCosByCategory}
        />
        {!hideChart && (
          <CategoryBudgetBarChart
            totalBudget={totalAmount}
            currentCosByCategory={budget.currentCosByCategory}
            referenceCosByCategory={budget.referenceCosByCategory}
            referenceCosTotal={budget.referenceCosTotal}
            referencePeriodMonthsUsed={budget.referencePeriodMonthsUsed}
            className="mt-4"
          />
        )}
        {needsReconnect && (
          <ReconnectContent
            locationId={budget.locationId}
            showButton={isOfficeOrAdmin}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default BudgetCard;
