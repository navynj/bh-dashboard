import { QB_REFRESH_EXPIRED } from '@/constants/error';
import {
  attachCurrentMonthCosToBudgets,
  attachReferenceCosToBudgets,
  ensureBudgetForMonth,
  getBudgetByLocationAndMonth,
  mapBudgetToDataType,
  QuickBooksApiContext,
} from '@/features/dashboard/budget';
import BudgetCard from '@/features/dashboard/budget/components/card/BudgetCard';
import LaborCard from '@/features/dashboard/labor/components/card/LaborCard';
import {
  getLaborDashboardData,
  getLaborTargetByLocationAndMonth,
} from '@/features/dashboard/labor';
import MonthlyRevenueCard from '@/features/dashboard/revenue/components/card/MonthlyRevenueCard';
import WeeklyRevenueCard from '@/features/dashboard/revenue/components/card/WeeklyRevenueCard';
import {
  getCloverWeeklyRevenueData,
  getRevenuePeriodData,
} from '@/features/dashboard/revenue';
import { getWeekOffsetContainingToday } from '@/features/dashboard/revenue/utils/week-range';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/utils';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

const LocationPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ yearMonth?: string }>;
}) => {
  // ===============================
  // Session
  // ===============================
  const session = await auth();
  const isOfficeOrAdmin = getOfficeOrAdmin(session?.user?.role);

  // ===============================
  // Location
  // ===============================
  const { id } = await params;
  const location = await prisma.location.findUnique({
    where: { id },
  });

  if (!location) {
    return notFound();
  }

  // ==============
  // Year Month
  // ===============================
  const { yearMonth: searchYearMonth } = await searchParams;
  const yearMonth = searchYearMonth ?? getCurrentYearMonth();
  if (!isValidYearMonth(yearMonth)) {
    redirect(
      `/dashboard/cost/location/${id}?yearMonth=${getCurrentYearMonth()}`,
    );
  }

  // ===============================
  // Budget
  // ===============================
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'http://localhost:3000';
  const headersList = await headers();
  const context: QuickBooksApiContext = {
    baseUrl,
    cookie: headersList.get('cookie'),
  };

  let budget = await getBudgetByLocationAndMonth(id, yearMonth);
  if (!budget) {
    if (!session?.user?.id) redirect('/auth');

    const created = await ensureBudgetForMonth({
      locationId: id,
      yearMonth,
      userId: session.user.id,
      context,
    });

    budget = created ? mapBudgetToDataType(created) : null;
  }

  if (budget) {
    const [withCos] = await attachCurrentMonthCosToBudgets(
      [budget],
      yearMonth,
      context,
    );
    budget = withCos;
    if (session?.user?.id) {
      const [withRef] = await attachReferenceCosToBudgets(
        [budget],
        yearMonth,
        session.user.id,
        context,
      );
      budget = withRef;
    }
  }

  if (!budget) {
    const startYearMonth = location.startYearMonth;
    const startMsg =
      startYearMonth != null
        ? `Budget for this location starts from ${startYearMonth}.`
        : 'No budget for this month.';
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
        <p>{startMsg}</p>
        <p className="mt-1 text-sm">Select a different month to view budget.</p>
      </div>
    );
  }

  const initialWeekOffset = getWeekOffsetContainingToday(yearMonth);
  const laborTargetRow = await getLaborTargetByLocationAndMonth(id, yearMonth);
  const [monthlyRevenue, weeklyRevenue, laborData] = await Promise.all([
    getRevenuePeriodData(id, yearMonth, context, {
      period: 'monthly',
      weekOffset: 0,
    }),
    getCloverWeeklyRevenueData(id, yearMonth, initialWeekOffset),
    getLaborDashboardData(id, yearMonth, context, {
      referenceIncomeTotal: budget.referenceIncomeTotal,
      laborTarget: laborTargetRow,
    }),
  ]);

  return (
    <div className="grid gap-4 max-lg:grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
        <MonthlyRevenueCard data={monthlyRevenue} />
        <WeeklyRevenueCard
          key={yearMonth}
          locationId={id}
          yearMonth={yearMonth}
          initialData={weeklyRevenue}
          initialWeekOffset={initialWeekOffset}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {budget ? (
          <BudgetCard
            budget={budget}
            isOfficeOrAdmin={isOfficeOrAdmin}
            yearMonth={yearMonth}
            needsReconnect={budget.error === QB_REFRESH_EXPIRED}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No budget for this location this month.
            <br />
            Please contact the administrator.
          </div>
        )}
        <LaborCard
          data={laborData}
          locationId={id}
          yearMonth={yearMonth}
          isOfficeOrAdmin={isOfficeOrAdmin}
        />
      </div>
    </div>
  );
};

export default LocationPage;
