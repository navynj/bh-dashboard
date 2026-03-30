// GET /api/dashboard/budget/settings — get default budget rate and reference period (office/admin can view; manager can view).
// PATCH /api/dashboard/budget/settings — update default budget rate and reference period (office/admin only).

import { NextRequest, NextResponse } from 'next/server';
import { parseBody, budgetSettingsPatchSchema } from '@/lib/api/schemas';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { getOrCreateBudgetSettings } from '@/features/dashboard/budget';
import { toApiErrorResponse } from '@/lib/core/errors';
import { prisma } from '@/lib/core/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
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
    return toApiErrorResponse(err, 'GET /api/dashboard/budget/settings error:');
  }
}

export async function PATCH(request: NextRequest) {
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
        { error: 'Only office or admin can update budget settings' },
        { status: 403 },
      );
    }

    const parsed = await parseBody(request, budgetSettingsPatchSchema);
    if ('error' in parsed) return parsed.error;
    const { budgetRate, referencePeriodMonths } = parsed.data;

    const existing = await getOrCreateBudgetSettings();
    const data: {
      budgetRate?: number;
      referencePeriodMonths?: number;
      updatedById?: string;
    } = { updatedById: session.user.id };
    if (budgetRate !== undefined) data.budgetRate = budgetRate;
    if (referencePeriodMonths !== undefined)
      data.referencePeriodMonths = referencePeriodMonths;

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
    return toApiErrorResponse(err, 'PATCH /api/dashboard/budget/settings error:');
  }
}
