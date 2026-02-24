import { unitToGram } from '@/constants/cost/unit';
import type { ProductMetadata } from '@/types/shopify';

export function calculateUnitPrice(productData: {
  price?: string | number;
  metadata?: ProductMetadata;
}): number {
  const price = +(productData.price || 0);
  const splitUnit = productData.metadata?.split_unit;
  const pakUnit = productData.metadata?.pak_unit;

  if (splitUnit && splitUnit > 0 && pakUnit && pakUnit > 0) {
    return price / splitUnit / pakUnit;
  }
  if (splitUnit && splitUnit > 0) {
    return price / splitUnit;
  }
  if (pakUnit && pakUnit > 0) {
    return price / pakUnit;
  }
  return price;
}

export function calculateGPriceFromUnitPrice(
  unitPrice: number,
  unit: string,
  metadata?: ProductMetadata,
): number | null {
  if (!unit) return null;
  const unitType = unit.toLowerCase().trim();

  if (unitType === 'pc') {
    const gPerPc = metadata?.g_per_pc;
    if (!gPerPc || gPerPc <= 0) return null;
    return unitPrice / gPerPc;
  }

  const numericUnitMatch = unitType.match(/^(\d+(?:\.\d+)?)\s*g$/);
  if (numericUnitMatch) {
    const grams = parseFloat(numericUnitMatch[1]);
    if (grams > 0) return unitPrice / grams;
  }

  const conversionFactor = unitToGram[unitType];
  if (!conversionFactor || conversionFactor <= 0) return null;
  return unitPrice / conversionFactor;
}

export function calculateGPrice(productData: {
  price?: string | number;
  metadata?: ProductMetadata;
}): number | null {
  const unitType = productData.metadata?.unit?.toLowerCase();
  if (!unitType) return null;
  const unitPrice = calculateUnitPrice(productData);
  return calculateGPriceFromUnitPrice(
    unitPrice,
    unitType,
    productData.metadata,
  );
}
