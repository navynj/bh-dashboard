// GET /api/budget/settings — get default budget rate and reference period (office/admin can view; manager can view).
// PATCH /api/budget/settings — update default budget rate and reference period (office/admin only).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canSetBudget } from '@/lib/auth';
import { getOrCreateBudgetSettings } from '@/lib/budget';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const settings = await getOrCreateBudgetSettings();
    return NextResponse.json({
      ok: true,
      settings: {
        id: settings.id,
        budgetRate: Number(settings.budgetRate),
        referencePeriodMonths: settings.referencePeriodMonths,
        updatedAt: settings.updatedAt.toISOString(),
        updatedById: settings.updatedById ?? null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get budget settings';
    console.error('GET /api/budget/settings error:', message);
    return NextResponse.json({ error: String(message) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!canSetBudget(session.user.role)) {
      return NextResponse.json(
        { error: 'Only office or admin can update budget settings' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const budgetRate =
      typeof body.budgetRate === 'number' ? body.budgetRate : undefined;
    const referencePeriodMonths =
      typeof body.referencePeriodMonths === 'number'
        ? body.referencePeriodMonths
        : undefined;

    if (budgetRate === undefined && referencePeriodMonths === undefined) {
      return NextResponse.json(
        { error: 'Provide budgetRate and/or referencePeriodMonths' },
        { status: 400 },
      );
    }

    const existing = await getOrCreateBudgetSettings();
    const data: { budgetRate?: number; referencePeriodMonths?: number; updatedById?: string } = {};
    if (budgetRate !== undefined) {
      if (budgetRate < 0 || budgetRate > 1) {
        return NextResponse.json(
          { error: 'budgetRate must be between 0 and 1 (e.g. 0.33 for 33%)' },
          { status: 400 },
        );
      }
      data.budgetRate = budgetRate;
    }
    if (referencePeriodMonths !== undefined) {
      if (referencePeriodMonths < 1 || referencePeriodMonths > 24) {
        return NextResponse.json(
          { error: 'referencePeriodMonths must be between 1 and 24' },
          { status: 400 },
        );
      }
      data.referencePeriodMonths = referencePeriodMonths;
    }
    data.updatedById = session.user.id;

    const updated = await prisma.budgetSettings.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({
      ok: true,
      settings: {
        id: updated.id,
        budgetRate: Number(updated.budgetRate),
        referencePeriodMonths: updated.referencePeriodMonths,
        updatedAt: updated.updatedAt.toISOString(),
        updatedById: updated.updatedById ?? null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update budget settings';
    console.error('PATCH /api/budget/settings error:', message);
    return NextResponse.json({ error: String(message) }, { status: 500 });
  }
}
