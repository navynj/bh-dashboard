import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';
import { enhanceCostItems } from '@/lib/cost/item-enhancement';
import { processIngredientsBatch, processPackagingsBatch, processLaborsBatch, processOthersBatch } from '@/lib/cost/batch-operations';
import { processPrices } from '@/lib/cost/price-processing';
import { updateCostTags } from '@/lib/cost/tag-operations';
import { logCostHistory } from '@/lib/cost/history-logging';
import type { CostSavePayload } from '@/features/cost/types/cost';

const ALLOWED_SORT_FIELDS = ['title', 'createdAt', 'updatedAt'] as const;
type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

function parseSortField(value: string | null): SortField {
  return ALLOWED_SORT_FIELDS.includes(value as SortField)
    ? (value as SortField)
    : 'createdAt';
}

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
    const search = searchParams.get('search')?.trim() ?? '';
    const sortBy = parseSortField(searchParams.get('sortBy'));
    const sortDir =
      searchParams.get('sortDir') === 'asc' ? ('asc' as const) : ('desc' as const);

    const where = search
      ? { title: { contains: search, mode: 'insensitive' as const } }
      : {};

    const costs = await prisma.cost.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      include: {
        prices: {
          select: {
            id: true,
            title: true,
            margin: true,
            price: true,
            base: true,
            isFinalPrice: true,
            rank: true,
          },
        },
        costTagRelations: {
          include: {
            Tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    const response = costs.map(({ costTagRelations, ...cost }) => ({
      ...cost,
      tags: costTagRelations.map((r) => r.Tag),
    }));

    return NextResponse.json({ costs: response });
  } catch (err) {
    return toApiErrorResponse(err, 'GET /api/cost error:');
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: CostSavePayload = await req.json();

    const cost = await prisma.cost.create({
      data: {
        title: body.title,
        totalCount: body.totalCount,
        lossAmount: body.lossAmount,
        finalWeight: body.finalWeight,
        locked: body.locked ?? false,
        ingredients: {
          createMany: {
            data: body.ingredients.map((i) => ({
              id: i.id, title: i.title, unit: i.unit, amount: i.amount,
              variantId: i.variantId, type: i.type,
              image: i.image ? (i.image as Prisma.InputJsonValue) : Prisma.JsonNull, rank: i.rank,
            })),
          },
        },
        packagings: {
          createMany: {
            data: body.packagings.map((p) => ({
              id: p.id, title: p.title, unit: p.unit, amount: p.amount,
              variantId: p.variantId, type: p.type,
              image: p.image ? (p.image as Prisma.InputJsonValue) : Prisma.JsonNull, rank: p.rank,
            })),
          },
        },
        labors: {
          createMany: {
            data: body.labors.map((l) => ({
              id: l.id, title: l.title, time: l.time, people: l.people, wage: l.wage, rank: l.rank,
            })),
          },
        },
        others: {
          createMany: {
            data: body.others.map((o) => ({
              id: o.id, title: o.title, amount: o.amount, rank: o.rank,
            })),
          },
        },
        prices: {
          createMany: {
            data: body.prices.map((p) => ({
              id: p.id, title: p.title, margin: p.margin, price: p.price,
              base: p.base, isFinalPrice: p.isFinalPrice, rank: p.rank,
            })),
          },
        },
      },
      include: {
        ingredients: { orderBy: { rank: 'asc' } },
        packagings: { orderBy: { rank: 'asc' } },
        labors: { orderBy: { rank: 'asc' } },
        others: { orderBy: { rank: 'asc' } },
        prices: { orderBy: { rank: 'asc' } },
        costMemos: {
          orderBy: { rank: 'asc' },
          include: { User: { select: { name: true, email: true } } },
        },
        costTagRelations: { include: { Tag: true } },
      },
    });

    // Fix price base references (FE UUID → DB ID for chained prices)
    await processPrices(cost.id, body.prices);
    await updateCostTags(cost.id, body.tagIds);
    await logCostHistory(cost.id, session!.user!.id!, 'created', { title: body.title });

    const shopifyConfig = await prisma.shopifyConfig.findFirst();
    const enhanced = shopifyConfig ? await enhanceCostItems(cost, shopifyConfig) : cost;

    const { costTagRelations, costMemos, ...rest } = enhanced as typeof cost;
    return NextResponse.json({
      cost: {
        ...rest,
        tags: costTagRelations.map((r: { Tag: { id: string; name: string; color: string } }) => r.Tag),
        costMemos: costMemos.map(({ User, ...m }: { User: { name: string | null; email: string | null } | null; [k: string]: unknown }) => ({ ...m, user: User })),
      },
    }, { status: 201 });
  } catch (err) {
    return toApiErrorResponse(err, 'POST /api/cost error:');
  }
}
