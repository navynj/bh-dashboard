// GET /api/budget/[locationId]?yearMonth=YYYY-MM — get budget for location and month.
// PATCH /api/budget/[locationId] — update existing budget's rate and reference period (office/admin), then recalc.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canSetBudget } from '@/lib/auth';
import {
  getBudgetByLocationAndMonth,
  ensureBudgetForMonth,
} from '@/lib/budget';
import { AppError, GENERIC_ERROR_MESSAGE } from '@/lib/errors';
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

    const isOfficeOrAdmin = canSetBudget(session.user.role);
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

    let budget = await getBudgetByLocationAndMonth(locationId, yearMonth);
    if (!budget && session.user.id) {
      await ensureBudgetForMonth({
        locationId,
        yearMonth,
        userId: session.user.id,
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
    console.error('GET /api/budget/[locationId] error:', err);
    const message =
      err instanceof AppError ? err.message : GENERIC_ERROR_MESSAGE;
    const status = err instanceof AppError ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
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
    if (!canSetBudget(session.user.role)) {
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

    const body = await request.json().catch(() => ({}));
    const yearMonth =
      typeof body.yearMonth === 'string'
        ? body.yearMonth
        : getCurrentYearMonth();
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: 'Invalid yearMonth; use YYYY-MM' },
        { status: 400 },
      );
    }

    const budgetRate =
      typeof body.budgetRate === 'number' ? body.budgetRate : undefined;
    const referencePeriodMonths =
      typeof body.referencePeriodMonths === 'number'
        ? body.referencePeriodMonths
        : undefined;
    const referenceData = body.referenceData as
      | {
          incomeTotal: number;
          cosByCategory: { categoryId: string; name: string; amount: number }[];
        }
      | undefined;

    await ensureBudgetForMonth({
      locationId,
      yearMonth,
      userId: session.user.id,
      budgetRate,
      referencePeriodMonths,
      referenceData,
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
    console.error('PATCH /api/budget/[locationId] error:', err);
    const message =
      err instanceof AppError ? err.message : GENERIC_ERROR_MESSAGE;
    const status = err instanceof AppError ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
