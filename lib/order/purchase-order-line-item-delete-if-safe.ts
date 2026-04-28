import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/prisma';

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Deletes a PO line (and its non-finalized fulfillment allocations) only when
 * nothing has been finalized for invoicing yet.
 */
export async function deletePurchaseOrderLineItemIfNoFinalizedFulfillments(
  purchaseOrderLineItemId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  const finalized = await db.fulfillmentLineItem.count({
    where: {
      purchaseOrderLineItemId,
      finalizedAt: { not: null },
    },
  });
  if (finalized > 0) return false;
  await db.fulfillmentLineItem.deleteMany({
    where: { purchaseOrderLineItemId },
  });
  await db.purchaseOrderLineItem.delete({
    where: { id: purchaseOrderLineItemId },
  });
  return true;
}
