import BudgetCardList from '@/components/features/budget/card/BudgetCardList';
import { BudgetSettingsForm } from '@/components/features/budget/form/BudgetSettingsForm';
import { auth, canSetBudget } from '@/lib/auth';
import {
  ensureBudgetForMonth,
  ensureBudgetsForMonth,
  getBudgetByLocationAndMonth,
  getBudgetsByMonth,
  getOrCreateBudgetSettings,
} from '@/lib/budget';
import { AppError, GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/utils';
import { BudgetDataType } from '@/types/budget';
import { redirect } from 'next/navigation';

type Props = { searchParams: Promise<{ yearMonth?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  // ===============================
  // Year Month
  // ===============================
  const { yearMonth: searchYearMonth } = await searchParams;
  const yearMonth = searchYearMonth ?? getCurrentYearMonth();
  if (!isValidYearMonth(yearMonth)) {
    redirect(`/budget?yearMonth=${getCurrentYearMonth()}`);
  }

  // ===============================
  // Redirect if not authenticated nor authorized
  // ===============================
  const session = await auth();
  if (!session) {
    redirect('/auth');
  }

  const managerLocationId = session?.user?.locationId ?? undefined;
  if (!canSetBudget(session?.user?.role) && managerLocationId) {
    redirect(`/budget/location/${managerLocationId}?yearMonth=${yearMonth}`);
  }

  // ===============================
  // Budget
  // ===============================
  const isOfficeOrAdmin = canSetBudget(session?.user.role);

  let budgetError: string | null = null;

  try {
    if (isOfficeOrAdmin) {
      await ensureBudgetsForMonth(yearMonth, session.user.id);
    } else if (managerLocationId) {
      await ensureBudgetForMonth({
        locationId: managerLocationId,
        yearMonth,
        userId: session.user.id,
      });
    }
  } catch (e) {
    console.error(e);
    budgetError = e instanceof AppError ? e.message : GENERIC_ERROR_MESSAGE;
  }

  // Get budget data (office/admin: all budgets ordered by location.createdAt; manager: single)
  let budgetData: BudgetDataType | null = null;
  let budgetsList: BudgetDataType[] = [];

  if (isOfficeOrAdmin) {
    budgetsList = await getBudgetsByMonth(yearMonth);
  } else if (managerLocationId) {
    budgetData =
      (await getBudgetByLocationAndMonth(managerLocationId, yearMonth)) ?? null;
  }

  const settings = await getOrCreateBudgetSettings();

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
      {isOfficeOrAdmin && (
        <BudgetSettingsForm
          initialBudgetRate={Number(settings.budgetRate)}
          initialReferencePeriodMonths={settings.referencePeriodMonths}
        />
      )}
    </>
  );
}
