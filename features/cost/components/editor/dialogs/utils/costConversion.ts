/**
 * Cost Conversion Utilities
 * Functions for converting Cost data to ProductType format
 */

import { ProductType } from '@/features/product/types';
import { CostApiResponse } from '@/features/cost/types/cost';
import { calculateUnitPrice } from '../../../utils/priceHelpers';

/**
 * Converts a Cost to ProductType-like format for ingredient selection
 */
export function convertCostToProductType(
  cost: CostApiResponse,
  costDetails: CostApiResponse
): ProductType {
  // Safely get arrays with default empty arrays
  const ingredients = costDetails.ingredients || [];
  const packagings = costDetails.packagings || [];
  const labors = costDetails.labors || [];
  const others = costDetails.others || [];

  // Calculate total weight of ingredients
  const totalWeight = (ingredients as Array<{ amount?: number }>).reduce(
    (acc: number, ingredient) => acc + (ingredient.amount || 0),
    0
  );

  const lossAmount = costDetails.lossAmount || 0;
  // finalWeight in costDetails is per-piece weight, not total weight
  // If finalWeight exists, use it directly; otherwise calculate from totalWeight - lossAmount
  // If totalCount is 0 or null, use totalWeight - lossAmount as default (total weight of ingredients)
  const weightPerPiece = costDetails.finalWeight
    ? costDetails.finalWeight
    : costDetails.totalCount > 0
    ? (totalWeight - lossAmount) / costDetails.totalCount
    : totalWeight - lossAmount; // Default to total weight of ingredients when totalCount is 0

  // Calculate total cost
  const ingredientCost = (ingredients as Array<{ amountPrice?: number }>).reduce(
    (acc: number, ingredient) => acc + (ingredient.amountPrice || 0),
    0
  );
  const packagingCost = (packagings as Array<{ amountPrice?: number }>).reduce(
    (acc: number, packaging) => acc + (packaging.amountPrice || 0),
    0
  );
  const laborCost = (labors as Array<{ time?: number; people?: number; wage?: number }>).reduce(
    (acc: number, labor) =>
      acc + (labor.time || 0) * (labor.people || 0) * (labor.wage || 0),
    0
  );
  const otherCost = (others as Array<{ amount?: number }>).reduce(
    (acc: number, other) => acc + (other.amount || 0),
    0
  );
  const totalCost = ingredientCost + packagingCost + laborCost + otherCost;
  
  // Calculate price per product using finalPrice or unitPrice
  let pricePerProduct = 0;
  
  if (costDetails.totalCount > 0) {
    // Check if there's a price with isFinalPrice = true
    const finalPrice = costDetails.prices?.find(
      (p: any) => p.isFinalPrice === true
    );
    
    if (finalPrice) {
      // Use the final price (already includes margin)
      pricePerProduct = finalPrice.price;
    } else {
      // Fallback to unit price calculation
      const unitPrice = calculateUnitPrice(costDetails);
      if (unitPrice !== null) {
        pricePerProduct = unitPrice;
      } else {
        // Fallback to totalCost / totalCount
        pricePerProduct = totalCost / costDetails.totalCount;
      }
    }
  }

  // Create ProductType-like object from Cost
  return {
    id: cost.id,
    variantId: cost.id,
    title: cost.title,
    price: pricePerProduct,
    unitPrice: pricePerProduct,
    gPrice: weightPerPiece > 0 ? pricePerProduct / weightPerPiece : null,
    productType: 'Cost',
    vendor: '',
    status: 'active',
    handle: cost.id,
    totalInventory: 0,
    tracksInventory: false,
    active: true,
    thumbnails: [],
    metadata: {
      unit: 'g',
      g_per_pc: weightPerPiece,
      costFinalWeight: weightPerPiece, // Store weight per piece for amount setting (개당 그램 값)
    },
  };
}

