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

export const getTopLevelCategories = (
  categories: { categoryId: string; name: string; amount: number }[],
) => {
  return [...categories]
    .filter((c) => isTopLevelCategory(c.categoryId))
    .sort(
      (a, b) =>
        getTopLevelCategoryIndex(a.categoryId) -
        getTopLevelCategoryIndex(b.categoryId),
    )
    .map((c) => ({ category: c.name, cos: c.amount }))
    .filter((c) => Number.isFinite(c.cos) && c.cos > 0);
};
