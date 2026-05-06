import type {
  IngredientEditorItem,
  LaborEditorItem,
  OtherEditorItem,
  PriceEditorItem,
} from '../types/cost';

export const UNIT_PRICE_KEY = 'unitPrice';

export function calcIngredientTotal(items: IngredientEditorItem[]): number {
  return items.reduce((sum, i) => {
    if (i.amountPrice != null) return sum + i.amountPrice;
    if (i.unitPrice != null) return sum + i.unitPrice * i.amount;
    return sum;
  }, 0);
}

export function calcPackagingTotal(items: IngredientEditorItem[]): number {
  return calcIngredientTotal(items);
}

export function calcLaborTotal(items: LaborEditorItem[]): number {
  return items.reduce((sum, l) => sum + l.time * l.people * l.wage, 0);
}

export function calcOtherTotal(items: OtherEditorItem[]): number {
  return items.reduce((sum, o) => sum + o.amount, 0);
}

export function calcTotalCost(
  ingredientTotal: number,
  packagingTotal: number,
  laborTotal: number,
  otherTotal: number,
): number {
  return ingredientTotal + packagingTotal + laborTotal + otherTotal;
}

export function calcPricePerProduct(totalCost: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return totalCost / totalCount;
}

export function calcPriceValue(
  item: PriceEditorItem,
  pricePerProduct: number,
  allPrices: PriceEditorItem[],
): number {
  let base: number;
  if (!item.base || item.base === UNIT_PRICE_KEY) {
    base = pricePerProduct;
  } else {
    const refPrice = allPrices.find((p) => p.id === item.base);
    base = refPrice ? refPrice.price : pricePerProduct;
  }
  return base * (1 + item.margin / 100);
}

/** Recalculates all price values given the current pricePerProduct */
export function recalcPrices(
  prices: PriceEditorItem[],
  pricePerProduct: number,
): PriceEditorItem[] {
  const updated = prices.map((p) => ({ ...p }));
  // Single pass — assumes prices are ordered so base prices come before dependents
  for (const p of updated) {
    p.price = calcPriceValue(p, pricePerProduct, updated);
  }
  return updated;
}
