import { LexoRank } from 'lexorank';
import { v4 as uuidv4 } from 'uuid';
import type {
  IngredientEditorItem,
  LaborEditorItem,
  OtherEditorItem,
  PriceEditorItem,
} from '../types/cost';

function nextRank(existingRanks: string[]): string {
  if (existingRanks.length === 0) return LexoRank.middle().toString();
  const last = existingRanks[existingRanks.length - 1]!;
  try {
    return LexoRank.parse(last).genNext().toString();
  } catch {
    return LexoRank.middle().toString();
  }
}

export function createNewIngredient(
  costId: string | undefined,
  existingRanks: string[],
): IngredientEditorItem {
  return {
    id: uuidv4(),
    costId: costId ?? '',
    title: '',
    unit: 'g',
    amount: 0,
    variantId: '',
    type: '',
    image: null,
    rank: nextRank(existingRanks),
    unitPrice: null,
    amountPrice: null,
    gPrice: null,
    isNew: true,
  };
}

export function createNewPackaging(
  costId: string | undefined,
  existingRanks: string[],
): IngredientEditorItem {
  return createNewIngredient(costId, existingRanks);
}

export function createNewLabor(
  costId: string | undefined,
  existingRanks: string[],
): LaborEditorItem {
  return {
    id: uuidv4(),
    costId: costId ?? '',
    title: '',
    time: 0,
    people: 1,
    wage: 0,
    rank: nextRank(existingRanks),
    isNew: true,
  };
}

export function createNewOther(
  costId: string | undefined,
  existingRanks: string[],
): OtherEditorItem {
  return {
    id: uuidv4(),
    costId: costId ?? '',
    title: '',
    amount: 0,
    rank: nextRank(existingRanks),
    isNew: true,
  };
}

export function createNewPrice(
  costId: string | undefined,
  existingRanks: string[],
  pricePerProduct: number,
): PriceEditorItem {
  return {
    id: uuidv4(),
    costId: costId ?? '',
    title: '',
    margin: 0,
    price: pricePerProduct,
    base: 'unitPrice',
    isFinalPrice: false,
    rank: nextRank(existingRanks),
  };
}
