import { prisma } from '@/lib/core/prisma';
import type { PriceSaveItem } from '@/features/cost/types/cost';

/**
 * Upsert prices for a cost. Handles FE-generated UUIDs for new costs by
 * building a map of old-id → db-id so that `base` references resolve correctly.
 */
export async function processPrices(costId: string, items: PriceSaveItem[]) {
  const existingIds = items.map((p) => p.id);
  await prisma.price.deleteMany({ where: { costId, id: { notIn: existingIds } } });

  // First pass: upsert all prices (base refs may still point to FE UUIDs for new items)
  const priceIdMap = new Map<string, string>();

  for (const item of items) {
    const upserted = await prisma.price.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        costId,
        title: item.title,
        margin: item.margin,
        price: item.price,
        base: item.base,
        isFinalPrice: item.isFinalPrice,
        rank: item.rank,
      },
      update: {
        title: item.title,
        margin: item.margin,
        price: item.price,
        base: item.base,
        isFinalPrice: item.isFinalPrice,
        rank: item.rank,
      },
    });
    priceIdMap.set(item.id, upserted.id);
  }

  // Second pass: fix any base references that point to a FE-only UUID
  for (const item of items) {
    if (!item.base) continue;
    const resolvedBase = priceIdMap.get(item.base) ?? item.base;
    if (resolvedBase !== item.base) {
      await prisma.price.update({
        where: { id: priceIdMap.get(item.id) ?? item.id },
        data: { base: resolvedBase },
      });
    }
  }
}
