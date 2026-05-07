import {
  ensureBudgetForMonth,
  getBudgetByLocationAndMonth,
  mapBudgetToDataType,
  QuickBooksApiContext,
} from '@/features/dashboard/budget';
import { ensureRevenueTargetForMonth } from '@/features/dashboard/revenue';
import LocationDashboardCards from '@/features/dashboard/location/components/LocationDashboardCards';
import DashboardCardsSkeleton from '@/features/dashboard/location/components/DashboardCardsSkeleton';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core';
import { getCurrentYearMonth, getInternalAppBaseUrl, isValidYearMonth } from '@/lib/utils';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

const LocationPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ yearMonth?: string }>;
}) => {
  const session = await auth();
  const isOfficeOrAdmin = getOfficeOrAdmin(session?.user?.role);

  const { id } = await params;

  // Managers can only view their own location — redirect instead of 403.
  if (!isOfficeOrAdmin) {
    const managerLocationId = session?.user?.locationId;
    if (!managerLocationId) redirect('/dashboard');
    if (managerLocationId !== id) {
      const { yearMonth: sp } = await searchParams;
      const qs = sp ? `?yearMonth=${sp}` : '';
      redirect(`/dashboard/location/${managerLocationId}${qs}`);
    }
  }

  const location = id
    ? await prisma.location.findUnique({ where: { id } })
    : await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!location) return notFound();

  const { yearMonth: searchYearMonth } = await searchParams;
  const yearMonth = searchYearMonth ?? getCurrentYearMonth();
  if (!isValidYearMonth(yearMonth)) {
    redirect(`/dashboard/location/${id}?yearMonth=${getCurrentYearMonth()}`);
  }

  const headersList = await headers();
  const context: QuickBooksApiContext = {
    baseUrl: getInternalAppBaseUrl(headersList),
    cookie: headersList.get('cookie'),
  };

  // Budget lookup is fast (DB only) — do it here so we can show a "no budget" message
  // without waiting for QB. ensureBudgetForMonth may call QB once if row is missing.
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

  if (!budget) {
    const startMsg =
      location.startYearMonth != null
        ? `Budget for this location starts from ${location.startYearMonth}.`
        : 'No budget for this month.';
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
        <p>{startMsg}</p>
        <p className="mt-1 text-sm">Select a different month to view budget.</p>
      </div>
    );
  }

  // Non-blocking: recompute Clover mix if no row exists for this month.
  void ensureRevenueTargetForMonth({ locationId: id, yearMonth });

  // All QB calls happen inside LocationDashboardCards — HTML shell streams immediately,
  // cards fill in as QB data arrives (~2-4s later).
  return (
    <Suspense fallback={<DashboardCardsSkeleton />}>
      <LocationDashboardCards
        budget={budget}
        locationId={id}
        yearMonth={yearMonth}
        userId={session?.user?.id}
        isOfficeOrAdmin={isOfficeOrAdmin}
        context={context}
      />
    </Suspense>
  );
};

export default LocationPage;
