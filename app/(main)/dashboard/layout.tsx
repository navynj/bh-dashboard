import MonthNav from '@/components/control/MonthNav';
import { getOrCreateBudgetSettings } from '@/features/dashboard/budget';
import { BudgetBulkEditDialog } from '@/features/dashboard/budget/components/dialog/BudgetBulkEditDialog';
import { BudgetSettingsDialog } from '@/features/dashboard/budget/components/dialog/BudgetSettingsDialog';
import DashboardSideNav from '@/features/dashboard/components/DashboardSideNav';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { getCurrentYearMonth } from '@/lib/utils';
import { redirect } from 'next/navigation';
import React, { Suspense } from 'react';

const BudgetLayout = async ({ children }: { children: React.ReactNode }) => {
  const yearMonth = getCurrentYearMonth();
  const session = await auth();
  if (session?.user?.role === 'supply') redirect('/order');
  const isOfficeOrAdmin = session?.user
    ? getOfficeOrAdmin(session.user.role)
    : false;
  const budgetSettings = isOfficeOrAdmin
    ? await getOrCreateBudgetSettings()
    : null;

  return (
    <>
      <div className="flex gap-12 max-sm:flex-col max-sm:gap-4">
        {isOfficeOrAdmin && <DashboardSideNav />}
        <div className="flex-1">
          <div className="flex items-center justify-center gap-2 py-2">
            <Suspense fallback={null}>
              <MonthNav currentYearMonth={yearMonth} />
            </Suspense>
            {/* For Budget Page only */}
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
        </div>
      </div>
    </>
  );
};

export default BudgetLayout;
