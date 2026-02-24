import type { EnhanceableItem } from '../utils/itemEnhancement';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { processItemsWithShopifyData } from '../utils/itemEnhancement';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return new Response('Session not found', { status: 401 });
    }

    const { id } = await params;

    const shopifyConfig = await prisma.shopifyConfig.findFirst();

    const data = await prisma.cost.findUnique({
      where: { id },
      include: {
        ingredients: { orderBy: { rank: 'asc' } },
        packagings: { orderBy: { rank: 'asc' } },
        labors: { orderBy: { rank: 'asc' } },
        others: { orderBy: { rank: 'asc' } },
        prices: { orderBy: { rank: 'asc' } },
        tags: { include: { Tag: true } },
      },
    });

    if (!data) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const configForEnhance = shopifyConfig
      ? {
          id: shopifyConfig.id,
          shopifyUrl: shopifyConfig.shopifyUrl,
          adminToken: shopifyConfig.adminToken,
          apiVersion: shopifyConfig.apiVersion,
          query: shopifyConfig.query,
        }
      : null;

    const [ingredients, packagings] = await Promise.all([
      processItemsWithShopifyData(
        data.ingredients as unknown as EnhanceableItem[],
        configForEnhance,
        'ingredient'
      ),
      processItemsWithShopifyData(
        data.packagings as unknown as EnhanceableItem[],
        configForEnhance,
        'packaging'
      ),
    ]);

    return NextResponse.json({
      ...data,
      ingredients,
      packagings,
      tags: data.tags?.map((ct) => ct.Tag) || [],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: (error as Error)?.message || 'Failed to fetch cost' },
      { status: 500 }
    );
  }
}
