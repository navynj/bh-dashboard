import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { BudgetWithLocationAndCategories } from '@/types/budget';
import { useRouter } from 'next/navigation';
import React from 'react';
import UpdateBudgetButton from './UpdateBudgetButton';
import { formatCurrency } from '@/lib/utils';
import { ReconnectContent } from './BudgetReconnect';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';

type BudgetCategoryRow = BudgetWithLocationAndCategories['categories'][number];

/** Parse QB categoryId: qb-{catIdx}-* = category, qb-{catIdx}-{subIdx}-* = subcategory */
function parseCategoryId(
  categoryId: string,
): { catIdx: number; subIdx?: number } {
  const parts = categoryId.split('-');
  if (parts.length < 2 || parts[0] !== 'qb') return { catIdx: -1 };
  const catIdx = parseInt(parts[1], 10);
  if (parts.length >= 4 && /^\d+$/.test(parts[2])) {
    return { catIdx, subIdx: parseInt(parts[2], 10) };
  }
  return { catIdx };
}

/** Group flat categories into parent + subcategories (by qb-{catIdx}-* and qb-{catIdx}-{subIdx}-*). */
function groupCategoriesWithSubs(
  categories: BudgetCategoryRow[],
): { category: BudgetCategoryRow; subcategories: BudgetCategoryRow[] }[] {
  const byCatIdx = new Map<
    number,
    { category: BudgetCategoryRow; subcategories: BudgetCategoryRow[] }
  >();
  for (const c of categories) {
    const { catIdx, subIdx } = parseCategoryId(c.categoryId);
    if (catIdx < 0) continue;
    if (subIdx === undefined) {
      byCatIdx.set(catIdx, { category: c, subcategories: [] });
    } else {
      const group = byCatIdx.get(catIdx);
      if (group) group.subcategories.push(c);
    }
  }
  const order = [...byCatIdx.keys()].sort((a, b) => a - b);
  return order.map((k) => byCatIdx.get(k)!);
}

function BudgetCard({
  b,
  isOfficeOrAdmin,
  yearMonth,
  needsReconnect = false,
}: {
  b: BudgetWithLocationAndCategories;
  isOfficeOrAdmin: boolean;
  yearMonth: string;
  needsReconnect?: boolean;
}) {
  const router = useRouter();
  const [updating, setUpdating] = React.useState(false);
  const [optimisticRate, setOptimisticRate] = React.useState<number | null>(
    null,
  );
  const [optimisticPeriod, setOptimisticPeriod] = React.useState<number | null>(
    null,
  );

  const totalAmount =
    typeof b.totalAmount === 'number' ? b.totalAmount : Number(b.totalAmount);
  const categories = b.categories ?? [];

  const displayRate =
    optimisticRate != null
      ? optimisticRate
      : (b.budgetRateUsed as number | null);
  const displayPeriod =
    optimisticPeriod != null ? optimisticPeriod : b.referencePeriodMonthsUsed;

  const onUpdateStart = React.useCallback((rate?: number, period?: number) => {
    setUpdating(true);
    setOptimisticRate(rate ?? null);
    setOptimisticPeriod(period ?? null);
  }, []);
  const onUpdateSuccess = React.useCallback(() => {
    router.refresh();
    setUpdating(false);
    setOptimisticRate(null);
    setOptimisticPeriod(null);
  }, [router]);
  const onUpdateError = React.useCallback(() => {
    setUpdating(false);
    setOptimisticRate(null);
    setOptimisticPeriod(null);
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          {b.location?.code ?? b.location?.name ?? b.locationId} Budget
        </CardTitle>
        {isOfficeOrAdmin && !needsReconnect && (
          <UpdateBudgetButton
            locationId={b.locationId}
            yearMonth={yearMonth}
            onUpdateStart={onUpdateStart}
            onUpdateSuccess={onUpdateSuccess}
            onUpdateError={onUpdateError}
          />
        )}
      </CardHeader>
      <CardContent className="h-full">
        <p className="text-2xl font-semibold">
          {updating ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Spinner className="size-5 " />
              <span>Updating…</span>
            </span>
          ) : (
            !needsReconnect && formatCurrency(totalAmount)
          )}
        </p>
        {(displayRate != null || displayPeriod != null) && (
          <p className="text-muted-foreground text-xs">
            {displayRate != null && `Rate: ${(displayRate * 100).toFixed(0)}%`}
            {displayPeriod != null &&
              `${displayRate != null ? ' · ' : ''}Ref: ${displayPeriod} months`}
          </p>
        )}
        {categories.length > 0 && (
          <ul className="mt-3 space-y-0 border-t pt-3 text-sm">
            {groupCategoriesWithSubs(categories).map(({ category, subcategories }) =>
              subcategories.length > 0 ? (
                <Collapsible key={category.id} defaultOpen={false}>
                  <li className="list-none">
                    <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md py-1 pr-1 text-left hover:bg-muted/50">
                      <span className="flex min-w-0 items-center gap-1">
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                        <span className="text-muted-foreground truncate">
                          {category.name}
                        </span>
                      </span>
                      <span className="shrink-0">
                        {formatCurrency(Number(category.amount))}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-muted pl-3">
                        {subcategories.map((sub) => (
                          <li
                            key={sub.id}
                            className="flex justify-between gap-2 py-0.5"
                          >
                            <span className="text-muted-foreground truncate text-xs">
                              {sub.name}
                            </span>
                            <span className="shrink-0 text-xs">
                              {formatCurrency(Number(sub.amount))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </li>
                </Collapsible>
              ) : (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1">
                    <span className="size-4 shrink-0" aria-hidden />
                    <span className="text-muted-foreground truncate">
                      {category.name}
                    </span>
                  </span>
                  <span className="shrink-0">
                    {formatCurrency(Number(category.amount))}
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
        {needsReconnect && (
          <ReconnectContent
            locationId={b.locationId}
            showButton={isOfficeOrAdmin}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default BudgetCard;
