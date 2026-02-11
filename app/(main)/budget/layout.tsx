import BudgetCardList from '@/components/features/budget/card/BudgetCardList';
import { BudgetSettingsForm } from '@/components/features/budget/form/BudgetSettingsForm';
import OnboardingList from '@/components/features/onboard/OnboardingList';
import Header from '@/components/layout/Header';
import MonthNav from '@/components/layout/MonthNav';
import { auth, canSetBudget } from '@/lib/auth';
import {
  ensureBudgetForMonth,
  ensureBudgetsForMonth,
  getBudgetByLocationAndMonth,
  getBudgetsByMonth,
  getOrCreateBudgetSettings,
} from '@/lib/budget';
import { AppError, GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { getPendingApprovals } from '@/lib/onboarding';
import { getCurrentYearMonth } from '@/lib/utils';
import type { BudgetDataType } from '@/types/budget';
import { redirect } from 'next/navigation';
import React from 'react';

const layout = async ({ children }: { children: React.ReactNode }) => {
  // =================
  // Auth
  // =================
  const session = await auth();
  if (!session?.user) redirect('/auth');
  if (session.user.status !== 'active') redirect('/onboarding');

  // =================
  // Onboarding
  // =================
  const canApprove =
    session?.user?.role === 'admin' || session?.user?.role === 'office';
  const pending =
    canApprove && session?.user?.role
      ? await getPendingApprovals(session.user.role)
      : [];

  // ===============================
  // Year Month
  // ===============================
  const yearMonth = getCurrentYearMonth();

  return (
    <div className="flex min-h-screen flex-col p-4 md:p-8">
      <main className="flex-1">
        <Header />
        <div className="space-y-6">
          <OnboardingList canApprove={canApprove} pending={pending} />
          <MonthNav currentYearMonth={yearMonth} />
          {children}
        </div>
      </main>
    </div>
  );
};

export default layout;
