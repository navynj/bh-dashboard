import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';

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
