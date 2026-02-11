// GET /api/cos — Cost of Sales (and income) from QuickBooks P&L for the reference period.
// Query: yearMonth (YYYY-MM, default current month), months (reference period, default from budget settings).
// Office/admin: returns COS for all locations. Manager: returns COS for their location only.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canSetBudget } from '@/lib/auth';
import {
  getReferenceIncomeAndCos,
  getOrCreateBudgetSettings,
  isValidYearMonth,
} from '@/lib/budget';
import { prisma } from '@/lib/prisma';
import { getCurrentYearMonth } from '@/lib/utils';

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

    const settings = await getOrCreateBudgetSettings();
    const monthsParam = searchParams.get('months');
    const months = monthsParam
      ? parseInt(monthsParam, 10)
      : settings.referencePeriodMonths;
    if (Number.isNaN(months) || months < 1 || months > 12) {
      return NextResponse.json(
        { error: 'Invalid months; use 1–24' },
        { status: 400 },
      );
    }

    const isOfficeOrAdmin = canSetBudget(session.user.role);
    const managerLocationId = session.user.locationId ?? undefined;

    if (isOfficeOrAdmin) {
      const locations = await prisma.location.findMany({
        select: { id: true, code: true, name: true },
      });
      const results = await Promise.all(
        locations.map(async (loc) => {
          const data = await getReferenceIncomeAndCos(
            session.user!.id,
            loc.id,
            yearMonth,
            months,
          );
          return {
            locationId: loc.id,
            location: { id: loc.id, code: loc.code, name: loc.name },
            incomeTotal: data.incomeTotal,
            cosByCategory: data.cosByCategory,
          };
        }),
      );
      return NextResponse.json({
        ok: true,
        yearMonth,
        months,
        locations: results,
      });
    }

    if (!managerLocationId) {
      return NextResponse.json(
        { error: 'Managers must have a location to view COS' },
        { status: 403 },
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: managerLocationId },
      select: { id: true, code: true, name: true },
    });
    const data = await getReferenceIncomeAndCos(
      session.user.id,
      managerLocationId,
      yearMonth,
      months,
    );
    return NextResponse.json({
      ok: true,
      yearMonth,
      months,
      locationId: managerLocationId,
      location: location
        ? { id: location.id, code: location.code, name: location.name }
        : null,
      incomeTotal: data.incomeTotal,
      cosByCategory: data.cosByCategory,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get COS';
    console.error('GET /api/cos error:', message);
    return NextResponse.json({ error: String(message) }, { status: 500 });
  }
}
