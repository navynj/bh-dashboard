import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TruncateWithTooltip } from '@/components/ui/truncate-with-tooltip';
import { ChevronRight } from 'lucide-react';
import AmountPercent from './AmountPercent';
import { parseCategoryPath } from '@/features/report/utils/category';
import {
  BudgetCategoryRow,
  type CategoryTreeNode,
  getCategoryColor,
} from './helpers';

function CategoryLabel({
  categoryId,
  name,
  textClassName = '',
  sortedTopLevelIndices,
  colorCategoryId,
}: {
  categoryId: string;
  name: string;
  textClassName?: string;
  sortedTopLevelIndices?: number[];
  /** When set, use this category for color (e.g. display parent so L1 HQ COS6 uses COS6 color). */
  colorCategoryId?: string;
}) {
  const color = getCategoryColor(
    colorCategoryId ?? categoryId,
    sortedTopLevelIndices,
  );
  return (
    <>
      <span
        className="size-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <TruncateWithTooltip
        content={name}
        className={`text-muted-foreground ${textClassName}`}
      >
        {name}
      </TruncateWithTooltip>
    </>
  );
}

function SubcategoryRow({
  sub,
  totalBudget,
  actualCosByCategoryId,
  sortedTopLevelIndices,
  parentCategoryId,
}: {
  sub: BudgetCategoryRow;
  totalBudget?: number;
  actualCosByCategoryId: Record<string, number>;
  sortedTopLevelIndices?: number[];
  /** Use display parent's color (e.g. L1 HQ COS6 under COS6 uses COS6 color). */
  parentCategoryId?: string;
}) {
  const displayAmount =
    actualCosByCategoryId[sub.categoryId] ?? Number(sub.amount);
  const hasActualCos = sub.categoryId in actualCosByCategoryId;
  const displayPercent =
    totalBudget != null &&
    totalBudget > 0 &&
    hasActualCos
      ? (displayAmount / totalBudget) * 100
      : sub.percent;
  const color = parentCategoryId
    ? getCategoryColor(parentCategoryId, sortedTopLevelIndices)
    : getCategoryColor(sub.categoryId, sortedTopLevelIndices);
  return (
    <li key={sub.id} className="flex justify-between gap-2 py-0.5">
      <TruncateWithTooltip
        content={sub.name}
        className="text-muted-foreground text-xs"
      >
        <span
          className="mr-1 inline-block size-2 rounded-[2px]"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        {sub.name}
      </TruncateWithTooltip>
      <span className="shrink-0 text-xs">
        <AmountPercent
          amount={displayAmount}
          percent={displayPercent}
          className="text-xs"
        />
      </span>
    </li>
  );
}

export function CollapsibleCategoryRow({
  category,
  subcategories,
  totalBudget,
  actualCosByCategoryId = {},
  sortedTopLevelIndices,
}: {
  category: BudgetCategoryRow;
  subcategories: BudgetCategoryRow[];
  totalBudget?: number;
  actualCosByCategoryId?: Record<string, number>;
  sortedTopLevelIndices?: number[];
}) {
  const directAmount = actualCosByCategoryId[category.categoryId];
  const hasDirectCos = category.categoryId in actualCosByCategoryId;
  const subSum =
    subcategories.length > 0
      ? subcategories.reduce(
          (s, sub) => s + (actualCosByCategoryId[sub.categoryId] ?? 0),
          0,
        )
      : 0;
  const isTopLevel = parseCategoryPath(category.categoryId).length === 1;
  const displayAmount = hasDirectCos
    ? (directAmount ?? 0)
    : isTopLevel && Number(category.amount) > 0
      ? Number(category.amount)
      : subSum ?? Number(category.amount);
  const displayPercent =
    totalBudget != null && totalBudget > 0
      ? (displayAmount / totalBudget) * 100
      : category.percent;
  return (
    <Collapsible key={category.id} defaultOpen={false}>
      <li className="list-none">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md py-1 pr-1 text-left hover:bg-muted/50">
          <span className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            <CategoryLabel categoryId={category.categoryId} name={category.name} sortedTopLevelIndices={sortedTopLevelIndices} />
          </span>
          <span className="shrink-0">
            <AmountPercent
              amount={displayAmount}
              percent={displayPercent}
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-muted pl-3">
            {subcategories.map((sub) => (
              <SubcategoryRow
                key={sub.id}
                sub={sub}
                totalBudget={totalBudget}
                actualCosByCategoryId={actualCosByCategoryId}
                sortedTopLevelIndices={sortedTopLevelIndices}
                parentCategoryId={category.categoryId}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

function sumChildrenCos(
  children: CategoryTreeNode[],
  actualCosByCategoryId: Record<string, number>,
): number {
  return children.reduce(
    (s, child) =>
      s +
      (actualCosByCategoryId[child.category.categoryId] ?? 0) +
      (child.children.length > 0
        ? sumChildrenCos(child.children, actualCosByCategoryId)
        : 0),
    0,
  );
}

/** Recursive tree row: CollapsibleCategoryRow when node has children, StaticCategoryRow when leaf. */
export function TreeCategoryRow({
  node,
  totalBudget,
  actualCosByCategoryId = {},
  sortedTopLevelIndices,
  parentCategoryIdForColor,
  depth = 0,
}: {
  node: CategoryTreeNode;
  totalBudget?: number;
  actualCosByCategoryId?: Record<string, number>;
  sortedTopLevelIndices?: number[];
  /** Parent categoryId for color (children use parent's color). */
  parentCategoryIdForColor?: string;
  depth?: number;
}) {
  const { category, children } = node;
  const hasDirectCos = category.categoryId in actualCosByCategoryId;
  const childrenSum =
    children.length > 0
      ? sumChildrenCos(children, actualCosByCategoryId)
      : 0;
  const isTopLevel = parseCategoryPath(category.categoryId).length === 1;
  const displayAmount = hasDirectCos
    ? (actualCosByCategoryId[category.categoryId] ?? 0)
    : isTopLevel && Number(category.amount) > 0
      ? Number(category.amount)
      : childrenSum ?? Number(category.amount);
  const displayPercent =
    totalBudget != null && totalBudget > 0
      ? (displayAmount / totalBudget) * 100
      : category.percent;

  if (children.length === 0) {
    return (
      <StaticCategoryRow
        category={category}
        totalBudget={totalBudget}
        actualCosByCategoryId={actualCosByCategoryId}
        sortedTopLevelIndices={sortedTopLevelIndices}
        colorCategoryId={parentCategoryIdForColor}
      />
    );
  }

  return (
    <Collapsible key={category.id} defaultOpen={false}>
      <li className="list-none">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md py-1 pr-1 text-left hover:bg-muted/50">
          <span className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            <CategoryLabel categoryId={category.categoryId} name={category.name} sortedTopLevelIndices={sortedTopLevelIndices} colorCategoryId={parentCategoryIdForColor} />
          </span>
          <span className="shrink-0">
            <AmountPercent
              amount={displayAmount}
              percent={displayPercent}
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-muted pl-3">
            {children.map((child) => (
              <TreeCategoryRow
                key={child.category.id}
                node={child}
                totalBudget={totalBudget}
                actualCosByCategoryId={actualCosByCategoryId}
                sortedTopLevelIndices={sortedTopLevelIndices}
                parentCategoryIdForColor={category.categoryId}
                depth={depth + 1}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

export function StaticCategoryRow({
  category,
  totalBudget,
  actualCosByCategoryId = {},
  sortedTopLevelIndices,
  colorCategoryId,
}: {
  category: BudgetCategoryRow;
  totalBudget?: number;
  actualCosByCategoryId?: Record<string, number>;
  sortedTopLevelIndices?: number[];
  colorCategoryId?: string;
}) {
  const displayAmount =
    actualCosByCategoryId[category.categoryId] ?? Number(category.amount);
  const hasActualCos = category.categoryId in actualCosByCategoryId;
  const displayPercent =
    totalBudget != null &&
    totalBudget > 0 &&
    hasActualCos
      ? (displayAmount / totalBudget) * 100
      : category.percent;
  return (
    <li key={category.id} className="flex items-center justify-between gap-2 py-1 pr-1">
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="size-4 shrink-0" aria-hidden />
        <CategoryLabel categoryId={category.categoryId} name={category.name} sortedTopLevelIndices={sortedTopLevelIndices} colorCategoryId={colorCategoryId} />
      </span>
      <span className="shrink-0">
        <AmountPercent
          amount={displayAmount}
          percent={displayPercent}
        />
      </span>
    </li>
  );
}
