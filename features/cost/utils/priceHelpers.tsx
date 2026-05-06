import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UNIT_PRICE } from '@/constants/cost/cost';
import type { CostListItem, CostPrice } from '../types/cost';

function formatPrice(value: number | null | undefined): React.ReactNode {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{value.toFixed(2)}</span>
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}

function getUnitPriceValue(prices: CostPrice[]): number | null {
  const unitPriceBased = prices.find((p) => p.base === UNIT_PRICE || !p.base);
  if (unitPriceBased?.price != null && unitPriceBased.margin != null) {
    return unitPriceBased.price / (1 + unitPriceBased.margin / 100);
  }
  return null;
}

export function getFinalPrice(cost: CostListItem): number | null {
  const finalPrice = cost.prices.find((p) => p.isFinalPrice);
  return finalPrice?.price ?? null;
}

export function renderFinalPrice(cost: CostListItem): React.ReactNode {
  const finalPrice = getFinalPrice(cost);
  const unitPrice = getUnitPriceValue(cost.prices);
  return formatPrice(finalPrice ?? unitPrice);
}

export function renderDefinedPrices(cost: CostListItem): React.ReactNode {
  const prices = cost.prices;
  const unitPriceValue = getUnitPriceValue(prices);
  const otherPrices = prices.filter((p) => p.base != null);

  const allPrices: Array<{ id: string; title: string; price: number | null }> =
    [];

  if (unitPriceValue != null) {
    allPrices.push({ id: 'unit-price', title: 'Unit Price', price: unitPriceValue });
  }

  otherPrices.forEach((p) =>
    allPrices.push({ id: p.id, title: p.title || 'Price', price: p.price }),
  );

  if (allPrices.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-0.5">
      {allPrices.map((p) => (
        <div key={p.id} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground min-w-[80px] shrink-0">
            {p.title}:
          </span>
          <span>{formatPrice(p.price)}</span>
        </div>
      ))}
    </div>
  );
}
