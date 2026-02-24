import { UNIT_PRICE } from '@/constants/cost/cost';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';
import type { IngredientPayloadType } from './[id]/types';
import type {
  LaborApiRequest,
  OtherApiRequest,
  PriceApiRequest,
  PriceApiResponse,
} from '@/features/cost/types/cost';
import { logCostHistory } from './[id]/utils/historyLogging';

function logCostHistoryCreate(
  costId: string,
  userId: string,
  action: 'created' | 'updated' | 'locked' | 'unlocked',
  changes?: Record<string, unknown>,
) {
  logCostHistory(costId, userId, action, changes).catch((e) =>
    console.error('Failed to log cost history', e),
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response('Session not found', { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const search = searchParams.get('search') || '';
    const tagIdsParam = searchParams.get('tagIds');
    const tagIds = tagIdsParam ? tagIdsParam.split(',') : [];
    const sortKey = searchParams.get('sortKey') || 'CREATED_AT';
    const reverse = searchParams.get('reverse') === 'true';
    const countOnly = searchParams.get('countOnly') === 'true';

    const where: {
      title?: { contains: string; mode: 'insensitive' };
      tags?: { some: { tagId: { in: string[] } } };
    } = {};
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (tagIds.length > 0) {
      where.tags = {
        some: { tagId: { in: tagIds } },
      };
    }

    let orderBy: {
      createdAt?: 'asc' | 'desc';
      updatedAt?: 'asc' | 'desc';
      title?: 'asc' | 'desc';
    } = { createdAt: 'desc' };
    if (sortKey === 'TITLE') {
      orderBy = { title: reverse ? 'desc' : 'asc' };
    } else if (sortKey === 'CREATED_AT') {
      orderBy = { createdAt: reverse ? 'asc' : 'desc' };
    } else if (sortKey === 'UPDATED_AT') {
      orderBy = { updatedAt: reverse ? 'asc' : 'desc' };
    }

    if (countOnly) {
      const totalCount = await prisma.cost.count({ where });
      const totalPages = Math.ceil(totalCount / pageSize);
      return NextResponse.json({ totalCount, totalPages }, { status: 200 });
    }

    const skip = (page - 1) * pageSize;

    const [costs, totalCount] = await Promise.all([
      prisma.cost.findMany({
        where,
        include: {
          prices: true,
          tags: { include: { Tag: true } },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.cost.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);
    const formattedCosts = costs.map((cost) => ({
      ...cost,
      tags: cost.tags?.map((ct) => ct.Tag) || [],
    }));

    return NextResponse.json(
      {
        costs: formattedCosts,
        pageInfo: {
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        totalPages,
        totalCount,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Failed to fetch costs' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let costId = '';

  try {
    const session = await auth();
    if (!session) {
      return new Response('Session not found', { status: 401 });
    }

    const {
      ingredients: ingredientsPayload,
      prices: pricesPayload,
      packagings: packagingsPayload,
      labors: laborsPayload,
      others: othersPayload,
      tags: tagsPayload,
      ...costPayload
    } = await req.json();

    const cost = await prisma.cost.create({
      data: {
        title: costPayload.title,
        totalCount: costPayload.totalCount ?? 1,
        lossAmount: costPayload.lossAmount,
        finalWeight: costPayload.finalWeight,
        locked: costPayload.locked ?? false,
      },
    });
    costId = cost.id;

    const ingredients = await prisma.ingredient.createManyAndReturn({
      data: (ingredientsPayload || []).map(
        ({ id, ...item }: IngredientPayloadType & { id?: string }) => ({
          ...item,
          costId,
        }),
      ),
    });

    const packagings = await prisma.packaging.createManyAndReturn({
      data: (packagingsPayload || []).map(
        ({ id, ...item }: IngredientPayloadType & { id?: string }) => ({
          ...item,
          costId,
        }),
      ),
    });

    const labors = await prisma.labor.createManyAndReturn({
      data: (laborsPayload || []).map(
        ({ id, ...item }: LaborApiRequest & { id?: string }) => ({
          ...item,
          costId,
        }),
      ),
    });

    const others = await prisma.other.createManyAndReturn({
      data: (othersPayload || []).map(
        ({ id, ...item }: OtherApiRequest & { id?: string }) => ({
          ...item,
          costId,
        }),
      ),
    });

    const initialPrices: PriceApiResponse[] = [];
    const finalPrices: PriceApiResponse[] = [];
    const priceIdMap: Record<string, string> = {
      unitPrice: UNIT_PRICE,
    };

    const pricesWithFinalPrice = (pricesPayload || []).filter(
      (p: PriceApiRequest & { isFinalPrice?: boolean }) =>
        p.isFinalPrice === true,
    );
    if (pricesWithFinalPrice.length > 1) {
      return NextResponse.json(
        {
          message: 'Only one price can have isFinalPrice set to true per cost',
        },
        { status: 400 },
      );
    }

    for (const { id, ...item } of pricesPayload || []) {
      const result = await prisma.price.create({
        data: {
          ...item,
          costId,
          isFinalPrice: item.isFinalPrice ?? false,
        },
      });
      priceIdMap[id] = result.id;
      initialPrices.push(result as unknown as PriceApiResponse);
    }

    for (let price of initialPrices) {
      const { id, base } = price;
      if (base && priceIdMap[base]) {
        await prisma.price.update({
          where: { id },
          data: { base: priceIdMap[base] },
        });
        price = { ...price, base: priceIdMap[base] } as PriceApiResponse;
      }
      finalPrices.push(price);
    }

    if (tagsPayload && Array.isArray(tagsPayload) && tagsPayload.length > 0) {
      await prisma.costTag.createMany({
        data: tagsPayload.map((tagId: string) => ({ costId, tagId })),
        skipDuplicates: true,
      });
    }

    const costTags = await prisma.costTag.findMany({
      where: { costId },
      include: { Tag: true },
    });

    if (session.user?.id) {
      await logCostHistoryCreate(costId, session.user.id, 'created', {
        title: cost.title,
      });
    }

    return NextResponse.json(
      {
        ...cost,
        ingredients,
        packagings,
        labors,
        others,
        prices: finalPrices,
        tags: costTags.map((ct) => ct.Tag),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    if (costId) {
      try {
        await prisma.cost.delete({ where: { id: costId } });
      } catch (e) {
        console.error(e);
      }
    }
    return NextResponse.json(
      { message: (error as Error)?.message || 'Error occurred' },
      { status: 500 },
    );
  }
}
