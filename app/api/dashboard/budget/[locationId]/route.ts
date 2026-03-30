// GET /api/dashboard/budget/[locationId]?yearMonth=YYYY-MM — get budget for location and month.
// PATCH /api/dashboard/budget/[locationId] — update existing budget's rate and reference period (office/admin), then recalc.

import { NextRequest, NextResponse } from 'next/server';
import { parseBody, budgetPatchSchema } from '@/lib/api/schemas';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  getBudgetByLocationAndMonth,
  ensureBudgetForMonth,
} from '@/features/dashboard/budget';
import type { QuickBooksApiContext } from '@/features/dashboard/budget';
import { toApiErrorResponse } from '@/lib/core/errors';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { locationId } = await params;
    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId required' },
        { status: 400 },
      );
    }

    const isOfficeOrAdmin = getOfficeOrAdmin(session.user.role);
    const managerLocationId = session.user.locationId ?? undefined;
    if (!isOfficeOrAdmin && managerLocationId !== locationId) {
      return NextResponse.json(
        { error: 'You can only view your own location budget' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get('yearMonth') || getCurrentYearMonth();
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: 'Invalid yearMonth; use YYYY-MM' },
        { status: 400 },
      );
    }

    const context: QuickBooksApiContext = {
      baseUrl: new URL(request.url).origin,
      cookie: request.headers.get('cookie'),
    };
    let budget = await getBudgetByLocationAndMonth(locationId, yearMonth);
    if (!budget && session.user.id) {
      await ensureBudgetForMonth({
        locationId,
        yearMonth,
        userId: session.user.id,
        context,
      });
      budget = await getBudgetByLocationAndMonth(locationId, yearMonth);
    }
    if (!budget) {
      return NextResponse.json(
        { error: 'No budget for this location and month' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, yearMonth, budget });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/dashboard/budget/[locationId] error:');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (!getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Only office or admin can update budget' },
        { status: 403 },
      );
    }

    const { locationId } = await params;
    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId required' },
        { status: 400 },
      );
    }

    const parsed = await parseBody(request, budgetPatchSchema);
    if ('error' in parsed) return parsed.error;
    const body = parsed.data;

    const yearMonth = body.yearMonth ?? getCurrentYearMonth();
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: 'Invalid yearMonth; use YYYY-MM' },
        { status: 400 },
      );
    }

    const budgetRate = body.budgetRate;
    const referencePeriodMonths = body.referencePeriodMonths;
    const referenceData = body.referenceData;

    const context: QuickBooksApiContext = {
      baseUrl: new URL(request.url).origin,
      cookie: request.headers.get('cookie'),
    };
    await ensureBudgetForMonth({
      locationId,
      yearMonth,
      userId: session.user.id,
      budgetRate,
      referencePeriodMonths,
      referenceData,
      context,
    });
    const budget = await getBudgetByLocationAndMonth(locationId, yearMonth);
    if (!budget) {
      return NextResponse.json(
        { error: 'Budget not found after update' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, yearMonth, budget });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'PATCH /api/dashboard/budget/[locationId] error:');
  }
}
