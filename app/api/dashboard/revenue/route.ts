// GET /api/dashboard/revenue?locationId=&yearMonth=YYYY-MM&period=monthly|weekly&weekOffset=0&includeDailyBars=true

import { getRevenuePeriodData } from '@/features/dashboard/revenue/utils/get-revenue-data';
import type { QuickBooksApiContext } from '@/features/dashboard/budget';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { toApiErrorResponse } from '@/lib/core/errors';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { weekRangeForMonth } from '@/features/dashboard/revenue/utils/week-range';

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
    const period = searchParams.get('period') || 'monthly';
    const weekOffsetRaw = searchParams.get('weekOffset');
    const includeDailyBars = searchParams.get('includeDailyBars') !== 'false';

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

    if (period !== 'monthly' && period !== 'weekly') {
      return NextResponse.json(
        { error: 'period must be monthly or weekly' },
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

    const data = await getRevenuePeriodData(
      locationId,
      yearMonth,
      context,
      {
        period,
        weekOffset,
        includeDailyBars: period === 'weekly' ? includeDailyBars : false,
      },
      undefined,
      session.user.id,
    );

    const range =
      period === 'weekly' ? weekRangeForMonth(yearMonth, weekOffset) : null;

    return NextResponse.json({
      ok: true,
      yearMonth,
      period,
      weekOffset,
      startDate: range?.startDate ?? null,
      endDate: range?.endDate ?? null,
      data,
    });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/dashboard/revenue error:');
  }
}
