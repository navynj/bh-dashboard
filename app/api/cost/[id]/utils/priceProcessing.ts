import { UNIT_PRICE } from '@/constants/cost/cost';
import type { PriceApiResponse } from '@/features/cost/types/cost';
import { prisma } from '@/lib/core/prisma';

interface PriceUpdateItem {
  id: string;
  data: Omit<PriceApiResponse, 'id'>;
  feId: string;
}

interface PriceCreateItem {
  feId: string;
  data: Omit<PriceApiResponse, 'id'> & { costId: string };
}

export async function processPrices(
  prevPrices: Array<{ id: string }>,
  pricesPayload: PriceApiResponse[] | undefined,
  costId: string,
): Promise<Array<{ id: string; [key: string]: unknown }>> {
  const pricesPayloadMap = new Map(
    (pricesPayload || []).map((item) => [item.id, item]),
  );
  const prevPriceIds = new Set(prevPrices.map((p) => p.id));

  const priceToUpdate: PriceUpdateItem[] = [];
  const priceToCreate: PriceCreateItem[] = [];
  const priceToDeleteIds: string[] = [];

  for (const prevPrice of prevPrices) {
    const priceData = pricesPayloadMap.get(prevPrice.id);
    if (priceData) {
      const { id: feId, ...data } = priceData;
      priceToUpdate.push({ id: prevPrice.id, data, feId });
    } else {
      priceToDeleteIds.push(prevPrice.id);
    }
  }

  for (const priceData of pricesPayload || []) {
    if (!prevPriceIds.has(priceData.id)) {
      const { id: feId, ...newPrice } = priceData;
      priceToCreate.push({ feId, data: { ...newPrice, costId } });
    }
  }

  const pricesWithFinalPrice = (pricesPayload || []).filter(
    (p) => (p as { isFinalPrice?: boolean }).isFinalPrice === true,
  );
  if (pricesWithFinalPrice.length > 1) {
    throw new Error(
      'Only one price can have isFinalPrice set to true per cost',
    );
  }

  const priceIdMap: Record<string, string> = {
    unitPrice: UNIT_PRICE,
  };

  const [updatedPrices, createdPrices] = await Promise.all([
    Promise.all(
      priceToUpdate.map(({ id, data }) =>
        prisma.price.update({
          where: { id },
          data: {
            title: data.title,
            margin: data.margin,
            price: data.price,
            base: data.base,
            rank: data.rank,
            isFinalPrice: data.isFinalPrice ?? false,
          },
        }),
      ),
    ),
    Promise.all(
      priceToCreate.map(({ data }) =>
        prisma.price.create({
          data: {
            title: data.title,
            margin: data.margin,
            price: data.price,
            costId: data.costId,
            base: data.base,
            rank: data.rank,
            isFinalPrice: data.isFinalPrice ?? false,
          },
        }),
      ),
    ),
    priceToDeleteIds.length > 0
      ? prisma.price.deleteMany({
          where: { id: { in: priceToDeleteIds } },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  priceToUpdate.forEach(({ feId, id }) => {
    priceIdMap[feId] = id;
  });
  priceToCreate.forEach(({ feId }, index) => {
    priceIdMap[feId] = createdPrices[index].id;
  });

  const finalPrices = await Promise.all(
    [...updatedPrices, ...createdPrices].map(async (price) => {
      const payloadPrice = pricesPayload?.find(
        (p) => priceIdMap[p.id] === price.id,
      );
      const updateData: { base?: string; isFinalPrice?: boolean } = {};

      if (
        payloadPrice?.base &&
        priceIdMap[payloadPrice.base] &&
        payloadPrice.base !== priceIdMap[payloadPrice.base]
      ) {
        updateData.base = priceIdMap[payloadPrice.base];
      }

      const payloadIsFinalPrice = (payloadPrice as { isFinalPrice?: boolean })
        ?.isFinalPrice;
      if (payloadIsFinalPrice === true) {
        const otherFinalPrice = await prisma.price.findFirst({
          where: {
            costId,
            id: { not: price.id },
            isFinalPrice: true,
          },
        });
        if (otherFinalPrice) {
          await prisma.price.update({
            where: { id: otherFinalPrice.id },
            data: { isFinalPrice: false },
          });
        }
        updateData.isFinalPrice = true;
      } else if (payloadIsFinalPrice === false) {
        updateData.isFinalPrice = false;
      }

      if (Object.keys(updateData).length > 0) {
        return prisma.price.update({
          where: { id: price.id },
          data: updateData,
        });
      }
      return price;
    }),
  );

  return finalPrices;
}
