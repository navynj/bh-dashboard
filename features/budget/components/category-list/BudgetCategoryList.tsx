import {
  CollapsibleCategoryRow,
  StaticCategoryRow,
  TreeCategoryRow,
} from './CategoryRows';
import {
  type BudgetCategoryRow,
  buildCategoryTree,
  groupCategoriesWithSubs,
  isCos1Branch,
} from './helpers';

/** Map categoryId -> actual COS amount for the displayed month (from QuickBooks). */
function cosByCategoryToMap(
  currentCosByCategory?: { categoryId: string; name: string; amount: number }[],
): Record<string, number> {
  if (!currentCosByCategory?.length) return {};
  return Object.fromEntries(
    currentCosByCategory.map((c) => [c.categoryId, c.amount]),
  );
}

function BudgetCategoryList({
  categories,
  totalBudget,
  currentCosByCategory,
}: {
  categories: BudgetCategoryRow[];
  /** Total budget (used for category percent: category amount / total budget). */
  totalBudget?: number;
  currentCosByCategory?: { categoryId: string; name: string; amount: number }[];
}) {
  if (categories.length === 0) return null;
  const actualCosByCategoryId = cosByCategoryToMap(currentCosByCategory);
  const groups = groupCategoriesWithSubs(categories);
  const treeRoots = buildCategoryTree(categories);

  return (
    <ul className="mt-3 space-y-0 border-t pt-3 text-sm">
      {groups.map(({ category, subcategories }) => {
        const treeRoot = treeRoots.find(
          (r) => r.category.categoryId === category.categoryId,
        );
        const useCos1Tree = isCos1Branch(category.name) && treeRoot != null;

        if (useCos1Tree && treeRoot) {
          return (
            <TreeCategoryRow
              key={category.id}
              node={treeRoot}
              totalBudget={totalBudget}
              actualCosByCategoryId={actualCosByCategoryId}
            />
          );
        }
        if (subcategories.length > 0) {
          return (
            <CollapsibleCategoryRow
              key={category.id}
              category={category}
              subcategories={subcategories}
              totalBudget={totalBudget}
              actualCosByCategoryId={actualCosByCategoryId}
            />
          );
        }
        return (
          <StaticCategoryRow
            key={category.id}
            category={category}
            totalBudget={totalBudget}
            actualCosByCategoryId={actualCosByCategoryId}
          />
        );
      })}
    </ul>
  );
}

export default BudgetCategoryList;
