// POST /api/budget — create or update budget for a month (office/admin).
// Uses current budget settings (rate, reference period) or body overrides.
// GET /api/budget?yearMonth=YYYY-MM — list budgets for that month (office/admin) or ensure budget exists for viewer's location.

import { NextRequest, NextResponse } from 'next/server';
import { parseBody, budgetPostSchema } from '@/lib/api/schemas';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  ensureBudgetForMonth,
  getBudgetsByMonth,
  getBudgetByLocationAndMonth,
} from '@/lib/budget';
import type { QuickBooksApiContext } from '@/lib/budget';
import { toApiErrorResponse } from '@/lib/core/errors';
import { prisma } from '@/lib/core/prisma';
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

    const isOfficeOrAdmin = getOfficeOrAdmin(session.user.role);
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

    const context: QuickBooksApiContext = {
      baseUrl: new URL(request.url).origin,
      cookie: request.headers.get('cookie'),
    };
    let budget = await getBudgetByLocationAndMonth(
      managerLocationId,
      yearMonth,
    );
    if (!budget) {
      await ensureBudgetForMonth({
        locationId: managerLocationId,
        yearMonth,
        userId: session.user.id,
        context,
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
    return toApiErrorResponse(err, 'GET /api/budget error:');
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
    if (!getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Only office or admin can set budget' },
        { status: 403 },
      );
    }

    const parsed = await parseBody(request, budgetPostSchema);
    if ('error' in parsed) return parsed.error;
    const body = parsed.data;

    const yearMonth = body.yearMonth ?? getCurrentYearMonth();
    const locations = body.locationIds?.length
      ? await prisma.location.findMany({ where: { id: { in: body.locationIds } } })
      : await prisma.location.findMany();
    const ids = locations.map((l) => l.id);

    const budgetRate = body.budgetRate;
    const referencePeriodMonths = body.referencePeriodMonths;
    const referenceData = body.referenceData;

    const context: QuickBooksApiContext = {
      baseUrl: new URL(request.url).origin,
      cookie: request.headers.get('cookie'),
    };
    const results = await Promise.all(
      ids.map((locationId) =>
        ensureBudgetForMonth({
          locationId,
          yearMonth,
          userId: session.user.id,
          budgetRate,
          referencePeriodMonths,
          referenceData,
          context,
        }),
      ),
    );

    const created = results
      .filter((b): b is NonNullable<typeof results[0]> => b != null)
      .map((b) => ({
        id: b.id,
        locationId: b.locationId,
        totalAmount: Number(b.totalAmount),
      }));

    return NextResponse.json({
      ok: true,
      yearMonth,
      created,
    });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'POST /api/budget error:');
  }
}
