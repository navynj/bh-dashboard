// POST /api/budget — create or update budget for a month (office/admin).
// Uses current budget settings (rate, reference period) or body overrides.
// GET /api/budget?yearMonth=YYYY-MM — list budgets for that month (office/admin) or ensure budget exists for viewer's location.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canSetBudget } from '@/lib/auth';
import {
  ensureBudgetForMonth,
  getBudgetsByMonth,
  getBudgetByLocationAndMonth,
} from '@/lib/budget';
import { AppError, GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getCurrentYearMonth, isValidYearMonth } from '@/lib/utils';

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
    const yearMonth = searchParams.get('yearMonth') || getCurrentYearMonth();
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: 'Invalid yearMonth; use YYYY-MM' },
        { status: 400 },
      );
    }

    const isOfficeOrAdmin = canSetBudget(session.user.role);
    const managerLocationId = session.user.locationId ?? undefined;

    if (isOfficeOrAdmin) {
      const budgets = await getBudgetsByMonth(yearMonth);
      return NextResponse.json({ ok: true, yearMonth, budgets });
    }

    if (!managerLocationId) {
      return NextResponse.json(
        { error: 'Managers must have a location to view budget' },
        { status: 403 },
      );
    }

    let budget = await getBudgetByLocationAndMonth(
      managerLocationId,
      yearMonth,
    );
    if (!budget) {
      await ensureBudgetForMonth({
        locationId: managerLocationId,
        yearMonth,
        userId: session.user.id,
      });
      budget = await getBudgetByLocationAndMonth(managerLocationId, yearMonth);
    }
    if (!budget) {
      return NextResponse.json(
        { error: 'No budget for this location and month' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, yearMonth, budget });
  } catch (err: unknown) {
    console.error('GET /api/budget error:', err);
    const message =
      err instanceof AppError ? err.message : GENERIC_ERROR_MESSAGE;
    const status = err instanceof AppError ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
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
        { error: 'Only office or admin can set budget' },
        { status: 403 },
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

    const locationIds = body.locationIds as string[] | undefined;
    const locations = locationIds?.length
      ? await prisma.location.findMany({ where: { id: { in: locationIds } } })
      : await prisma.location.findMany();
    const ids = locations.map((l) => l.id);

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

    const results = await Promise.all(
      ids.map((locationId) =>
        ensureBudgetForMonth({
          locationId,
          yearMonth,
          userId: session.user.id,
          budgetRate,
          referencePeriodMonths,
          referenceData,
        }),
      ),
    );

    const created = results.map((b) => ({
      id: b.id,
      locationId: b.locationId,
      totalAmount: Number(b.totalAmount),
      categoriesCount: b.categories.length,
    }));

    return NextResponse.json({
      ok: true,
      yearMonth,
      created,
    });
  } catch (err: unknown) {
    console.error('POST /api/budget error:', err);
    const message =
      err instanceof AppError ? err.message : GENERIC_ERROR_MESSAGE;
    const status = err instanceof AppError ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
