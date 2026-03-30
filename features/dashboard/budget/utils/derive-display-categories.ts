import type { BudgetCategoryRow } from '@/features/dashboard/budget/types';
import {
  getTopLevelCategoriesForCharts,
  getTopLevelCategoryIndex,
  parseCategoryPath,
} from '@/features/report/utils/category';

type CosRow = { categoryId: string; name: string; amount: number };

/**
 * Flat rows for the budget category list from **this month’s QuickBooks P&L only**
 * (`currentCosByCategory`). Reference-period data is not merged in: QB omits zero lines,
 * and unioning with reference created $0 ghost rows and drift vs QB.
 *
 * Top-level rows use the same roll-up as charts when passing current-only
 * ({@link getTopLevelCategoriesForCharts}(current, [])).
 */
export function deriveBudgetDisplayCategories(
  currentCosByCategory: CosRow[] | undefined,
  _referenceCosByCategory: CosRow[] | undefined,
  totalBudget: number,
  currentCosTotal?: number,
  noReference?: boolean,
): BudgetCategoryRow[] {
  const current = currentCosByCategory ?? [];

  if (!current.length) return [];

  const hasBudget = Number.isFinite(totalBudget) && totalBudget > 0;
  const totalForPercent = hasBudget
    ? totalBudget
    : noReference &&
        Number.isFinite(currentCosTotal) &&
        (currentCosTotal ?? 0) > 0
      ? currentCosTotal!
      : 0;
  const hasPercent = hasBudget || (noReference && totalForPercent > 0);

  const mergedTop = getTopLevelCategoriesForCharts(current, []);

  const topRows: BudgetCategoryRow[] = mergedTop
    .map((row) => {
      const amount = Number.isFinite(row.amount) ? row.amount : 0;
      return {
        id: row.categoryId,
        categoryId: row.categoryId,
        name: row.name,
        amount,
        percent: hasPercent ? (amount / totalForPercent) * 100 : null,
      };
    })
    .filter((row) => row.amount !== 0);

  const childRows: BudgetCategoryRow[] = current
    .filter((c) => parseCategoryPath(c.categoryId).length > 1)
    .map((c) => {
      const amount = Number.isFinite(c.amount) ? c.amount : 0;
      return {
        id: c.categoryId,
        categoryId: c.categoryId,
        name: c.name,
        amount,
        percent: hasPercent ? (amount / totalForPercent) * 100 : null,
      };
    })
    .filter((row) => row.amount !== 0);

  return [...topRows, ...childRows].sort(
    (a, b) =>
      getTopLevelCategoryIndex(a.categoryId) -
      getTopLevelCategoryIndex(b.categoryId),
  );
}
