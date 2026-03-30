import BudgetCardList from '@/features/dashboard/budget/components/card/BudgetCardList';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  attachCurrentMonthCosToBudgets,
  attachReferenceCosToBudgets,
  ensureBudgetsForMonth,
  getBudgetsByMonth,
} from '@/features/dashboard/budget';
import { AppError, GENERIC_ERROR_MESSAGE } from '@/lib/core/errors';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/utils';
import type { QuickBooksApiContext } from '@/features/dashboard/budget';
import type { BudgetDataType } from '@/features/dashboard/budget';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

type Props = { searchParams: Promise<{ yearMonth?: string }> };

export default async function BudgetPage({ searchParams }: Props) {
  // ===============================
  // Year Month
  // ===============================
  const { yearMonth: searchYearMonth } = await searchParams;
  const yearMonth = searchYearMonth ?? getCurrentYearMonth();
  if (!isValidYearMonth(yearMonth)) {
    redirect(`/dashboard/budget?yearMonth=${getCurrentYearMonth()}`);
  }

  // ===============================
  // Redirect if not authenticated nor authorized
  // ===============================
  const session = await auth();
  if (!session) {
    redirect('/auth');
  }

  const managerLocationId = session?.user?.locationId ?? undefined;
  if (!getOfficeOrAdmin(session?.user?.role) && managerLocationId) {
    redirect(
      `/dashboard/budget/location/${managerLocationId}?yearMonth=${yearMonth}`,
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'http://localhost:3000';
  const headersList = await headers();
  const context: QuickBooksApiContext = {
    baseUrl,
    cookie: headersList.get('cookie'),
  };

  // ===============================
  // Budget
  // ===============================
  const isOfficeOrAdmin = getOfficeOrAdmin(session?.user.role);

  let budgetError: string | null = null;

  try {
    await ensureBudgetsForMonth(yearMonth, session.user.id, context);
  } catch (e) {
    console.error(e);
    budgetError = e instanceof AppError ? e.message : GENERIC_ERROR_MESSAGE;
  }

  // Get budget data (office/admin: all budgets ordered by location.createdAt; manager: single)
  let budgetData: BudgetDataType | null = null;
  let budgetsList: BudgetDataType[] = [];

  budgetsList = await getBudgetsByMonth(yearMonth);
  budgetsList = await attachCurrentMonthCosToBudgets(
    budgetsList,
    yearMonth,
    context,
  );
  budgetsList = await attachReferenceCosToBudgets(
    budgetsList,
    yearMonth,
    session.user.id,
    context,
  );

  return (
    <>
      <BudgetCardList
        yearMonth={yearMonth}
        isOfficeOrAdmin={isOfficeOrAdmin}
        budget={budgetData}
        budgets={budgetsList}
        locationId={managerLocationId ?? null}
        budgetError={budgetError}
      />
    </>
  );
}
