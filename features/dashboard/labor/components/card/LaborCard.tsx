'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UpdateBudgetButton from '@/features/dashboard/budget/components/card/UpdateBudgetButton';
import { resolveLaborTargetFromBudget } from '@/features/dashboard/labor/utils/compute-labor-target';
import type { LaborDashboardData } from '../../types';
import LaborChart from '../chart/LaborChart';
import LaborCategoryList from '../list/LaborCategoryList';
import LaborSummary from '../LaborSummary';
import { useRouter } from 'next/navigation';
import React from 'react';
import LaborTimeNeeded from '../LaborTimeNeeded';

const LABOR_MODAL_RATE_TOOLTIP =
  'Percentage of average monthly income from the reference period used as the labor target. Same field as Cost budget.';

const LABOR_MODAL_REF_TOOLTIP =
  'Number of months of historical income used to compute that average. Same field as Cost budget.';

type LaborCardProps = {
  data: LaborDashboardData;
  locationId: string;
  yearMonth: string;
  isOfficeOrAdmin: boolean;
};

export default function LaborCard({
  data,
  locationId,
  yearMonth,
  isOfficeOrAdmin,
}: LaborCardProps) {
  const router = useRouter();
  const [updating, setUpdating] = React.useState(false);
  const [optimisticRate, setOptimisticRate] = React.useState<number | null>(
    null,
  );
  const [optimisticPeriod, setOptimisticPeriod] = React.useState<number | null>(
    null,
  );

  const displayRate =
    optimisticRate != null ? optimisticRate : data.displayRate;
  const displayPeriod =
    optimisticPeriod != null ? optimisticPeriod : data.displayPeriod;

  const { targetLabor } = resolveLaborTargetFromBudget({
    referenceIncomeTotal: data.referenceIncomeTotal,
    referencePeriodMonthsUsed: displayPeriod,
    budgetRateUsed: displayRate,
  });

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
        <CardTitle className="text-xl font-bold">Labor</CardTitle>
        {isOfficeOrAdmin && (
          <UpdateBudgetButton
            buttonLabel="Update Target"
            modalTitle="Update target"
            locationId={locationId}
            yearMonth={yearMonth}
            currentBudgetRate={displayRate}
            currentReferencePeriodMonths={displayPeriod}
            rateFieldLabel="Rate"
            rateHint="(% of average monthly income)"
            periodFieldLabel="Ref"
            periodHint="(months)"
            rateTooltip={LABOR_MODAL_RATE_TOOLTIP}
            periodTooltip={LABOR_MODAL_REF_TOOLTIP}
            idPrefix="labor-update-target"
            onUpdateStart={onUpdateStart}
            onUpdateSuccess={onUpdateSuccess}
            onUpdateError={onUpdateError}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <LaborTimeNeeded />
        <div className="flex flex-col gap-4 sm:items-center">
          <LaborSummary
            totalLabor={data.totalLabor}
            targetLabor={targetLabor}
            displayRate={displayRate}
            displayPeriod={displayPeriod}
            referenceIncomeTotal={data.referenceIncomeTotal}
            isUpdating={updating}
          />
          <LaborChart
            categories={data.categories}
            totalLabor={data.totalLabor}
          />
        </div>
        <LaborCategoryList
          categories={data.categories}
          totalLabor={data.totalLabor}
        />
      </CardContent>
    </Card>
  );
}
