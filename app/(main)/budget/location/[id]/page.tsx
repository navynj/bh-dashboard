import BudgetCardList from '@/components/features/budget/card/BudgetCardList';
import TotalBudgetChart from '@/components/features/budget/chart/TotalBudgetChart';
import {
  attachCurrentMonthCosToBudgets,
  attachReferenceCosToBudgets,
  ensureBudgetForMonth,
  getBudgetByLocationAndMonth,
  mapBudgetToDataType,
} from '@/lib/budget';
import type { QuickBooksApiContext } from '@/lib/budget';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/utils';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import CategoryBudgetBarChart from '@/components/features/budget/chart/CategoryBudgetBarChart';
import BackButton from '@/components/layout/BackButton';

const LocationPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ yearMonth?: string }>;
}) => {
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
    redirect(`/budget/location/${id}?yearMonth=${getCurrentYearMonth()}`);
  }

  // ===============================
  // Budget
  // ===============================
  const session = await auth();
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

  return (
    <>
      <BackButton />
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-2/3">
          <TotalBudgetChart
            className="max-h-[450px]"
            size="lg"
            totalAmount={budget.totalAmount}
            currentCosByCategory={budget.currentCosByCategory ?? []}
            referencePeriodMonthsUsed={budget.referencePeriodMonthsUsed}
          />
          <CategoryBudgetBarChart
            className="w-full md:w-2/3 md:mx-auto"
            totalBudget={budget.totalAmount}
            currentCosByCategory={budget.currentCosByCategory ?? []}
            referenceCosByCategory={budget.referenceCosByCategory ?? []}
            referenceCosTotal={budget.referenceCosTotal}
            referencePeriodMonthsUsed={budget.referencePeriodMonthsUsed}
          />
        </div>
        <BudgetCardList
          yearMonth={yearMonth}
          isOfficeOrAdmin={false}
          budget={budget}
          budgets={[]}
          locationId={id}
          hideChart={true}
        />
      </div>
    </>
  );
};

export default LocationPage;
