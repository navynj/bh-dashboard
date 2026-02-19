import { BudgetSettingsDialog } from '@/components/features/budget/BudgetSettingsDialog';
import MonthNav from '@/components/layout/MonthNav';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { getOrCreateBudgetSettings } from '@/lib/budget';
import { getCurrentYearMonth } from '@/lib/utils';
import React from 'react';
import { Suspense } from 'react';

const BudgetLayout = async ({ children }: { children: React.ReactNode }) => {
  const yearMonth = getCurrentYearMonth();
  const session = await auth();
  const isOfficeOrAdmin = session?.user
    ? getOfficeOrAdmin(session.user.role)
    : false;
  const budgetSettings =
    isOfficeOrAdmin ? await getOrCreateBudgetSettings() : null;

  return (
    <>
      <div className="flex items-center justify-center gap-2 py-2">
        <Suspense fallback={null}>
          <MonthNav currentYearMonth={yearMonth} />
        </Suspense>
        {isOfficeOrAdmin && budgetSettings && (
          <BudgetSettingsDialog
            initialBudgetRate={Number(budgetSettings.budgetRate)}
            initialReferencePeriodMonths={
              budgetSettings.referencePeriodMonths
            }
          />
        )}
      </div>
      {children}
    </>
  );
};

export default BudgetLayout;
