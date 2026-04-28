/**
 * Shopify order line "effective" quantity for hub DB + inbox:
 * after order edits, removed units are reflected in `currentQuantity` (GraphQL) /
 * `current_quantity` (REST), while `quantity` may still show the original purchased count.
 */

export function effectiveAdminGraphqlLineItemQuantity(li: {
  quantity?: number | null;
  currentQuantity?: number | null;
}): number {
  if (
    typeof li.currentQuantity === 'number' &&
    Number.isFinite(li.currentQuantity)
  ) {
    return Math.max(0, Math.trunc(li.currentQuantity));
  }
  const q = li.quantity;
  if (typeof q === 'number' && Number.isFinite(q)) {
    return Math.max(0, Math.trunc(q));
  }
  const n = Number(q);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

/** REST / webhook `line_items[]` (snake_case). */
export function effectiveRestOrderLineItemQuantity(li: {
  quantity?: unknown;
  current_quantity?: unknown;
  fulfillable_quantity?: unknown;
}): number {
  const cur = li.current_quantity;
  if (typeof cur === 'number' && Number.isFinite(cur)) {
    return Math.max(0, Math.trunc(cur));
  }
  const q = li.quantity;
  if (typeof q === 'number' && Number.isFinite(q)) {
    return Math.max(0, Math.trunc(q));
  }
  const fq = li.fulfillable_quantity;
  if (typeof fq === 'number' && Number.isFinite(fq)) {
    return Math.max(0, Math.trunc(fq));
  }
  const n = Number(q);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}
