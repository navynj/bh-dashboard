import { UNIT_PRICE } from '@/constants/cost/cost';
import type {
  IngredientApiResponse,
  PackagingApiResponse,
  PriceApiResponse,
} from '../../types/cost';

export function prepareImageForApi(
  image: { src: string; alt: string } | string | null | undefined,
): string | null {
  if (!image) return null;
  if (typeof image === 'object') return JSON.stringify(image);
  return image;
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function prepareIngredientsForDuplicate(
  ingredients: IngredientApiResponse[],
): Array<
  Omit<
    IngredientApiResponse,
    'id' | 'costId' | 'unitPrice' | 'amountPrice' | 'gPrice' | 'metadata'
  > & { id: string }
> {
  return ingredients.map(
    ({ id, costId, unitPrice, amountPrice, gPrice, metadata, ...item }) => ({
      ...item,
      id: newId(),
    }),
  );
}

export function preparePackagingsForDuplicate(
  packagings: PackagingApiResponse[],
): Array<
  Omit<
    PackagingApiResponse,
    'id' | 'costId' | 'unitPrice' | 'amountPrice' | 'gPrice' | 'metadata'
  > & { id: string }
> {
  return packagings.map(
    ({ id, costId, unitPrice, amountPrice, gPrice, metadata, ...item }) => ({
      ...item,
      id: newId(),
    }),
  );
}

export function preparePricesForDuplicate(
  prices: PriceApiResponse[],
): Array<
  Omit<PriceApiResponse, 'id' | 'costId'> & { id: string; base: string | null }
> {
  const priceIdMap: Record<string, string> = {};
  const newPrices = prices.map(({ id, costId, ...item }) => {
    const nid = newId();
    priceIdMap[id] = nid;
    return { ...item, id: nid };
  });
  return newPrices.map((price) => ({
    ...price,
    base: price.base && priceIdMap[price.base] ? priceIdMap[price.base] : null,
  }));
}

export function prepareLaborsForDuplicate(
  labors: Array<{ id: string; costId?: string; [key: string]: unknown }>,
): Array<Omit<(typeof labors)[0], 'id' | 'costId'> & { id: string }> {
  return labors.map(({ id, costId, ...item }) => ({ ...item, id: newId() }));
}

export function prepareOthersForDuplicate(
  others: Array<{ id: string; costId?: string; [key: string]: unknown }>,
): Array<Omit<(typeof others)[0], 'id' | 'costId'> & { id: string }> {
  return others.map(({ id, costId, ...item }) => ({ ...item, id: newId() }));
}

export function preparePricesForApi(
  prices: Array<{
    base?: string | null;
    rank?: string;
    margin?: number;
    price?: number;
    [key: string]: unknown;
  }>,
): Array<{
  base: string | null;
  rank: string;
  margin?: number;
  price?: number;
  [key: string]: unknown;
}> {
  return prices.map(({ base, rank, ...item }) => ({
    ...item,
    base: base === UNIT_PRICE ? null : (base ?? null),
    rank: rank?.toString() ?? '',
  }));
}
