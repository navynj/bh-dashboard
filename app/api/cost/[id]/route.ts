import { NextRequest, NextResponse } from 'next/server';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';
import { enhanceCostItems } from '@/lib/cost/item-enhancement';
import { processIngredientsBatch, processPackagingsBatch, processLaborsBatch, processOthersBatch } from '@/lib/cost/batch-operations';
import { processPrices } from '@/lib/cost/price-processing';
import { updateCostTags } from '@/lib/cost/tag-operations';
import { logCostHistory } from '@/lib/cost/history-logging';
import { compareItems } from '@/lib/cost/change-detection';
import type { CostSavePayload } from '@/features/cost/types/cost';

type RouteContext = { params: Promise<{ id: string }> };

const COST_INCLUDE = {
  ingredients: { orderBy: { rank: 'asc' as const } },
  packagings: { orderBy: { rank: 'asc' as const } },
  labors: { orderBy: { rank: 'asc' as const } },
  others: { orderBy: { rank: 'asc' as const } },
  prices: { orderBy: { rank: 'asc' as const } },
  costMemos: {
    orderBy: { rank: 'asc' as const },
    include: { User: { select: { name: true, email: true } } },
  },
  costTagRelations: { include: { Tag: true } },
} as const;

function flattenCost(cost: Awaited<ReturnType<typeof fetchCost>>) {
  if (!cost) return null;
  const { costTagRelations, costMemos, ...rest } = cost;
  return {
    ...rest,
    tags: costTagRelations.map((r) => r.Tag),
    costMemos: costMemos.map(({ User, ...m }) => ({ ...m, user: User })),
  };
}

async function fetchCost(id: string) {
  return prisma.cost.findUnique({ where: { id }, include: COST_INCLUDE });
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const raw = await fetchCost(id);
    if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const shopifyConfig = await prisma.shopifyConfig.findFirst();
    const cost = shopifyConfig
      ? flattenCost(await enhanceCostItems(raw, shopifyConfig))
      : flattenCost(raw);

    return NextResponse.json({ cost });
  } catch (err) {
    return toApiErrorResponse(err, 'GET /api/cost/[id] error:');
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body: CostSavePayload = await req.json();

    // Snapshot before update for change detection
    const before = await prisma.cost.findUnique({
      where: { id },
      include: { ingredients: true, packagings: true, labors: true, others: true, prices: true },
    });

    await prisma.cost.update({
      where: { id },
      data: {
        title: body.title,
        totalCount: body.totalCount,
        lossAmount: body.lossAmount,
        finalWeight: body.finalWeight,
        locked: body.locked,
      },
    });

    await Promise.all([
      processIngredientsBatch(id, body.ingredients),
      processPackagingsBatch(id, body.packagings),
      processLaborsBatch(id, body.labors),
      processOthersBatch(id, body.others),
    ]);
    await processPrices(id, body.prices);
    await updateCostTags(id, body.tagIds);

    // Build change log
    const changes: Record<string, unknown> = {};
    if (before) {
      const fields = ['title', 'totalCount', 'lossAmount', 'finalWeight', 'locked'] as const;
      for (const f of fields) {
        if (body[f] !== undefined && body[f] !== before[f]) {
          changes[f] = { from: before[f], to: body[f] };
        }
      }
      type C = { id: string; title?: string; [k: string]: unknown };
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const ingChanges = compareItems(before.ingredients as unknown as C[], body.ingredients as unknown as C[], 'ingredient');
      const pkgChanges = compareItems(before.packagings as unknown as C[], body.packagings as unknown as C[], 'packaging');
      const lbrChanges = compareItems(before.labors as unknown as C[], body.labors as unknown as C[], 'labor');
      const othChanges = compareItems(before.others as unknown as C[], body.others as unknown as C[], 'other');
      const prcChanges = compareItems(before.prices as unknown as C[], body.prices as unknown as C[], 'price');
      /* eslint-enable @typescript-eslint/no-explicit-any */
      if (ingChanges.length) changes.ingredients = ingChanges;
      if (pkgChanges.length) changes.packaging = pkgChanges;
      if (lbrChanges.length) changes.labor = lbrChanges;
      if (othChanges.length) changes.other = othChanges;
      if (prcChanges.length) changes.price = prcChanges;
    }
    if (Object.keys(changes).length > 0) {
      await logCostHistory(id, session!.user!.id!, 'updated', changes);
    }

    const raw = await fetchCost(id);
    if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const shopifyConfig = await prisma.shopifyConfig.findFirst();
    const cost = shopifyConfig
      ? flattenCost(await enhanceCostItems(raw, shopifyConfig))
      : flattenCost(raw);

    return NextResponse.json({ cost });
  } catch (err) {
    return toApiErrorResponse(err, 'PUT /api/cost/[id] error:');
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    await prisma.cost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toApiErrorResponse(err, 'DELETE /api/cost/[id] error:');
  }
}
