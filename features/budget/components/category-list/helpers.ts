import { CHART_COLORS } from '@/constants/color';
import { parseCategoryPath } from '@/features/report/utils/category';
import type { BudgetWithLocationAndCategories } from '@/features/budget';

export type BudgetCategoryRow =
  BudgetWithLocationAndCategories['categories'][number];
type CategoryGroup = {
  category: BudgetCategoryRow | null;
  subcategories: BudgetCategoryRow[];
};

/** Parse QB categoryId: qb-{catIdx}-* = category, qb-{catIdx}-{subIdx}-* = subcategory (supports path-only ids). */
export function parseCategoryId(categoryId: string): {
  catIdx: number;
  subIdx?: number;
  path: number[];
} {
  const path = parseCategoryPath(categoryId);
  const catIdx = path[0] ?? -1;
  const subIdx = path.length >= 2 ? path[1] : undefined;
  return { catIdx, subIdx, path };
}

/** Group flat categories into parent + direct subcategories (by path length 1 vs 2). */
export function groupCategoriesWithSubs(
  categories: BudgetCategoryRow[],
): { category: BudgetCategoryRow; subcategories: BudgetCategoryRow[] }[] {
  const byCatIdx = new Map<number, CategoryGroup>();

  for (const c of categories) {
    const { catIdx, path } = parseCategoryId(c.categoryId);
    if (catIdx < 0) continue;
    const isTopLevel = path.length === 1;
    const isDirectChild = path.length === 2;
    const existing = byCatIdx.get(catIdx) ?? {
      category: null,
      subcategories: [],
    };
    if (isTopLevel) {
      existing.category = c;
      byCatIdx.set(catIdx, existing);
    } else if (isDirectChild) {
      existing.subcategories.push(c);
      byCatIdx.set(catIdx, existing);
    }
  }

  const order = [...byCatIdx.keys()].sort((a, b) => a - b);
  return order
    .map((k) => byCatIdx.get(k)!)
    .filter(
      (
        group,
      ): group is {
        category: BudgetCategoryRow;
        subcategories: BudgetCategoryRow[];
      } => group.category != null,
    );
}

export type CategoryTreeNode = {
  category: BudgetCategoryRow;
  children: CategoryTreeNode[];
};

/** Build a full tree from flat categories (by path prefix). Root nodes have path length 1. */
export function buildCategoryTree(
  categories: BudgetCategoryRow[],
): CategoryTreeNode[] {
  const byPath = new Map<string, BudgetCategoryRow>();
  for (const c of categories) {
    const path = parseCategoryPath(c.categoryId);
    if (path.length === 0) continue;
    byPath.set(path.join('-'), c);
  }

  function childrenOf(path: number[]): CategoryTreeNode[] {
    const depth = path.length + 1;
    const result: CategoryTreeNode[] = [];
    let idx = 0;
    while (true) {
      const childPath = [...path, idx];
      const key = childPath.join('-');
      const row = byPath.get(key);
      if (row == null) break;
      result.push({
        category: row,
        children: childrenOf(childPath),
      });
      idx += 1;
    }
    return result;
  }

  const roots: CategoryTreeNode[] = [];
  let rootIdx = 0;
  while (true) {
    const path = [rootIdx];
    const key = path.join('-');
    const row = byPath.get(key);
    if (row == null) break;
    roots.push({ category: row, children: childrenOf(path) });
    rootIdx += 1;
  }
  return roots;
}

/** True when this category (or its name) should show full nested tree and collapsible rows. */
export function isCos1Branch(name: string): boolean {
  return name.includes('COS1');
}

export function formatPercent(percent: number | null): string | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  return `${percent.toFixed(1)}%`;
}

export function getCategoryColor(categoryId: string): string {
  const { catIdx } = parseCategoryId(categoryId);
  return catIdx >= 0
    ? CHART_COLORS[catIdx % CHART_COLORS.length]
    : 'var(--muted)';
}
