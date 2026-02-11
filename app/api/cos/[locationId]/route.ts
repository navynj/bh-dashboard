// GET /api/cos/[locationId] — Cost of Sales (and income) from QuickBooks P&L for one location.
// Query: yearMonth (YYYY-MM, default current month), months (reference period, default from budget settings).
// Office/admin: any location. Manager: only their own location.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canSetBudget } from '@/lib/auth';
import {
  getReferenceIncomeAndCos,
  getOrCreateBudgetSettings,
} from '@/lib/budget';
import { prisma } from '@/lib/prisma';
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
        { error: 'You can only view COS for your own location' },
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

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, code: true, name: true },
    });
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 },
      );
    }

    const data = await getReferenceIncomeAndCos(
      session.user.id,
      locationId,
      yearMonth,
      months,
    );

    return NextResponse.json({
      ok: true,
      yearMonth,
      months,
      locationId: location.id,
      location: { id: location.id, code: location.code, name: location.name },
      incomeTotal: data.incomeTotal,
      cosByCategory: data.cosByCategory,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get COS';
    console.error('GET /api/cos/[locationId] error:', message);
    return NextResponse.json({ error: String(message) }, { status: 500 });
  }
}
