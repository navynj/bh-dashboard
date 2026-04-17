import type { PoLineItemView } from '../types/purchase-order';
import type { PrePoLineDraft } from '../types/shopify-draft';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function norm(s: string | null | undefined): string {
  return (s ?? '').trim();
}

/** Primary `productTitle`, then `variantTitle`, then stable `id`. */
export function comparePoLineByProductTitleAsc(a: PoLineItemView, b: PoLineItemView): number {
  const d0 = collator.compare(norm(a.productTitle), norm(b.productTitle));
  if (d0 !== 0) return d0;
  const d1 = collator.compare(norm(a.variantTitle), norm(b.variantTitle));
  if (d1 !== 0) return d1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortPoLineItemsByProductTitleAsc<T extends PoLineItemView>(lines: readonly T[]): T[] {
  return [...lines].sort(comparePoLineByProductTitleAsc);
}

function draftStableKey(d: PrePoLineDraft): string {
  return d.shopifyLineItemGid ?? d.shopifyLineItemId ?? '';
}

export function comparePrePoLineDraftByProductTitleAsc(
  a: PrePoLineDraft,
  b: PrePoLineDraft,
): number {
  const d0 = collator.compare(norm(a.productTitle), norm(b.productTitle));
  if (d0 !== 0) return d0;
  return collator.compare(draftStableKey(a), draftStableKey(b));
}

export function sortPrePoLineDraftsByProductTitleAsc(
  lines: readonly PrePoLineDraft[],
): PrePoLineDraft[] {
  return [...lines].sort(comparePrePoLineDraftByProductTitleAsc);
}
