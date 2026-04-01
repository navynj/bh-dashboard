// GET /api/dashboard/revenue/clover?locationId=&yearMonth=YYYY-MM&weekOffset=0

import { getCloverWeeklyRevenueData } from '@/features/dashboard/revenue/utils/get-clover-weekly-revenue';
import { weekRangeForMonth } from '@/features/dashboard/revenue/utils/week-range';
import {
  attachReferenceCosToBudgets,
  getBudgetByLocationAndMonth,
  type QuickBooksApiContext,
} from '@/features/dashboard/budget';
import { resolveMonthlyTargetIncome } from '@/features/dashboard/revenue/utils/get-revenue-data';
import type { RevenueBudgetMetadata } from '@/features/dashboard/revenue/utils/get-revenue-data';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { toApiErrorResponse } from '@/lib/core/errors';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');
    const yearMonth = searchParams.get('yearMonth') || getCurrentYearMonth();
    const weekOffsetRaw = searchParams.get('weekOffset');

    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId is required' },
        { status: 400 },
      );
    }

    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: 'Invalid yearMonth; use YYYY-MM' },
        { status: 400 },
      );
    }

    const isOfficeOrAdmin = getOfficeOrAdmin(session.user.role);
    const managerLocationId = session.user.locationId ?? undefined;
    if (!isOfficeOrAdmin && managerLocationId !== locationId) {
      return NextResponse.json(
        { error: 'You can only view revenue for your own location' },
        { status: 403 },
      );
    }

    const weekOffset =
      weekOffsetRaw != null && weekOffsetRaw !== ''
        ? Number.parseInt(weekOffsetRaw, 10)
        : 0;
    if (!Number.isFinite(weekOffset)) {
      return NextResponse.json(
        { error: 'weekOffset must be an integer' },
        { status: 400 },
      );
    }

    const context: QuickBooksApiContext = {
      baseUrl: new URL(request.url).origin,
      cookie: request.headers.get('cookie'),
    };

    let budget = await getBudgetByLocationAndMonth(locationId, yearMonth);
    if (budget && session.user.id) {
      const [withRef] = await attachReferenceCosToBudgets(
        [budget],
        yearMonth,
        session.user.id,
        context,
      );
      budget = withRef;
    }

    const budgetMeta: RevenueBudgetMetadata | undefined = budget
      ? {
          referenceIncomeTotal: budget.referenceIncomeTotal,
          referencePeriodMonthsUsed: budget.referencePeriodMonthsUsed,
          budgetRateUsed:
            budget.budgetRateUsed != null
              ? Number(budget.budgetRateUsed)
              : null,
        }
      : undefined;

    const monthlyTargetIncome = await resolveMonthlyTargetIncome(
      locationId,
      yearMonth,
      budget,
      budgetMeta,
      session.user.id,
      context,
    );

    const data = await getCloverWeeklyRevenueData(
      locationId,
      yearMonth,
      weekOffset,
      monthlyTargetIncome,
    );

    const range = weekRangeForMonth(yearMonth, weekOffset);

    return NextResponse.json({
      ok: true,
      yearMonth,
      weekOffset,
      startDate: range.startDate,
      endDate: range.endDate,
      data,
    });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/dashboard/revenue/clover error:');
  }
}
