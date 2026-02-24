import { BudgetBulkEditDialog } from '@/features/budget/components/dialog/BudgetBulkEditDialog';
import { BudgetSettingsDialog } from '@/features/budget/components/dialog/BudgetSettingsDialog';
import MonthNav from '@/components/control/MonthNav';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { getOrCreateBudgetSettings } from '@/features/budget';
import { getCurrentYearMonth } from '@/lib/utils';
import { redirect } from 'next/navigation';
import React, { Suspense } from 'react';

const BudgetLayout = async ({ children }: { children: React.ReactNode }) => {
  const yearMonth = getCurrentYearMonth();
  const session = await auth();
  if (session?.user?.role === 'assistant') redirect('/delivery');
  const isOfficeOrAdmin = session?.user
    ? getOfficeOrAdmin(session.user.role)
    : false;
  const budgetSettings = isOfficeOrAdmin
    ? await getOrCreateBudgetSettings()
    : null;

  return (
    <>
      <div className="flex items-center justify-center gap-2 py-2">
        <Suspense fallback={null}>
          <MonthNav currentYearMonth={yearMonth} />
        </Suspense>
        {isOfficeOrAdmin && budgetSettings && (
          <>
            <BudgetBulkEditDialog />
            <BudgetSettingsDialog
              initialBudgetRate={Number(budgetSettings.budgetRate)}
              initialReferencePeriodMonths={
                budgetSettings.referencePeriodMonths
              }
            />
          </>
        )}
      </div>
      {children}
    </>
  );
};

export default BudgetLayout;
