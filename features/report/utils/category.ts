/** Path from root: leading numeric segments after "qb" (e.g. qb-0-0-0 → [0,0,0], qb-0-COS1 → [0]). */
export function parseCategoryPath(categoryId: string): number[] {
  const parts = categoryId.split('-');
  if (parts.length < 2 || parts[0] !== 'qb') return [];
  const path: number[] = [];
  for (let i = 1; i < parts.length; i++) {
    if (/^\d+$/.test(parts[i])) path.push(parseInt(parts[i], 10));
    else break;
  }
  return path;
}

export const isTopLevelCategory = (categoryId: string) =>
  parseCategoryPath(categoryId).length === 1;

export const getTopLevelCategoryIndex = (categoryId: string): number => {
  const path = parseCategoryPath(categoryId);
  if (path.length === 0) return Number.MAX_SAFE_INTEGER;
  return path[0] ?? Number.MAX_SAFE_INTEGER;
};

/** Derive top-level display name from subcategory name (e.g. "MAIN - COS3" → "MAIN"). */
function topLevelNameFromSub(name: string): string {
  const i = name.indexOf(' - ');
  return i > 0 ? name.slice(0, i).trim() : name;
}

export const getTopLevelCategories = (
  categories: { categoryId: string; name: string; amount: number }[],
) => {
  if (!categories?.length) return [];
  const byTopIdx = new Map<
    number,
    { name: string; cos: number; fromTopLevel: boolean }
  >();
  for (const c of categories) {
    const path = parseCategoryPath(c.categoryId);
    if (path.length === 0) continue;
    const topIdx = path[0];
    const amount = Number.isFinite(c.amount) ? c.amount : 0;
    const existing = byTopIdx.get(topIdx);
    if (path.length === 1) {
      byTopIdx.set(topIdx, {
        name: c.name,
        cos: existing ? existing.cos + amount : amount,
        fromTopLevel: true,
      });
    } else {
      const name = existing?.fromTopLevel
        ? existing.name
        : (existing?.name ?? topLevelNameFromSub(c.name));
      byTopIdx.set(topIdx, {
        name,
        cos: (existing?.cos ?? 0) + amount,
        fromTopLevel: existing?.fromTopLevel ?? false,
      });
    }
  }
  return [...byTopIdx.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => ({ category: v.name, cos: v.cos }));
};

type CosCategory = { categoryId: string; name: string; amount: number };

/** Top-level categories only (path.length === 1), no summing of children. Use this so donut and bar chart show the same COS amounts per category. */
export function getTopLevelCategoryRows(
  categories: CosCategory[],
): CosCategory[] {
  return [...(categories ?? [])]
    .filter((c) => isTopLevelCategory(c.categoryId))
    .sort(
      (a, b) =>
        getTopLevelCategoryIndex(a.categoryId) -
        getTopLevelCategoryIndex(b.categoryId),
    );
}

/** Same shape as getTopLevelCategories but from top-level rows only (no aggregation). Use for donut so it matches bar chart and list. */
export function getTopLevelCategoriesTopLevelOnly(
  categories: CosCategory[],
): { category: string; cos: number }[] {
  return getTopLevelCategoryRows(categories ?? []).map((r) => ({
    category: r.name,
    cos: Number.isFinite(r.amount) ? r.amount : 0,
  }));
}

/**
 * Top-level rows for charts: union of current + reference top-level so all COS categories appear.
 * Amount = direct top-level row when API has it; else sum of children (e.g. COS3 = 602 when only subcategory rows exist).
 */
export function getTopLevelCategoriesForCharts(
  currentCosByCategory: CosCategory[] | undefined,
  referenceCosByCategory: CosCategory[] | undefined,
): CosCategory[] {
  const current = currentCosByCategory ?? [];
  const reference = referenceCosByCategory ?? [];

  const topIndices = new Set<number>();
  for (const c of current) {
    const path = parseCategoryPath(c.categoryId);
    if (path.length > 0) topIndices.add(path[0]);
  }
  for (const c of reference) {
    const path = parseCategoryPath(c.categoryId);
    if (path.length === 1) topIndices.add(path[0]);
  }

  const byIdx = new Map<
    number,
    { categoryId: string; name: string; amount: number }
  >();
  for (const idx of topIndices) {
    const refRow = reference.find((c) => parseCategoryPath(c.categoryId)[0] === idx && parseCategoryPath(c.categoryId).length === 1);
    const curRow = current.find((c) => parseCategoryPath(c.categoryId)[0] === idx && parseCategoryPath(c.categoryId).length === 1);
    const name = refRow?.name ?? curRow?.name ?? `COS${idx + 1}`;
    const categoryId = curRow?.categoryId ?? refRow?.categoryId ?? `qb-${idx}`;

    let amount = 0;
    if (curRow != null && Number.isFinite(curRow.amount)) {
      amount = curRow.amount;
    } else {
      for (const c of current) {
        const path = parseCategoryPath(c.categoryId);
        if (path.length > 0 && path[0] === idx && Number.isFinite(c.amount))
          amount += c.amount;
      }
    }

    byIdx.set(idx, { categoryId, name, amount });
  }

  return [...byIdx.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row);
}
