// GET /api/budget/[locationId]/[categoryId] — get category budget for a location
// Office/admin: any location. Manager: only their own locationId.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canSetBudget } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentYearMonth } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; categoryId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { locationId, categoryId } = await params;
    if (!locationId || !categoryId) {
      return NextResponse.json(
        { error: 'locationId and categoryId required' },
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

    const budget = await prisma.budget.findUnique({
      where: {
        locationId_yearMonth: { locationId, yearMonth },
      },
      select: { id: true },
    });

    if (!budget) {
      return NextResponse.json(
        { error: 'No budget found for this location and month' },
        { status: 404 },
      );
    }

    const category = await prisma.budgetCategory.findUnique({
      where: {
        budgetId_categoryId: { budgetId: budget.id, categoryId },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'No category budget found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      category: {
        id: category.id,
        categoryId: category.categoryId,
        name: category.name,
        amount: Number(category.amount),
        percent: category.percent != null ? Number(category.percent) : null,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to get category budget';
    console.error('GET /api/budget/[locationId]/[categoryId] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
