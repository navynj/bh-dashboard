import { CHART_COLORS } from '@/constants/color';
import { formatCurrency } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import type { LaborCategoryItem } from '../../types';

type LaborCategoryListProps = {
  categories: LaborCategoryItem[];
  /** Expense D P&L total for % column; otherwise sum of category amounts. */
  totalLabor?: number;
};

export default function LaborCategoryList({
  categories,
  totalLabor,
}: LaborCategoryListProps) {
  if (categories.length === 0) return null;

  const sumCategories = categories.reduce((s, c) => s + c.amount, 0);
  const total =
    totalLabor != null && totalLabor > 0 ? totalLabor : sumCategories;

  return (
    <ul className="border-t pt-3 text-sm">
      {categories.map((c, index) => {
        const pct = total > 0 ? c.amount / total : 0;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        return (
          <li
            key={c.id}
            className="flex items-center gap-2 border-b border-border/60 py-2 last:border-b-0"
          >
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span
              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: color }}
            />
            <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(c.amount)}
            </span>
            <span className="text-muted-foreground w-14 text-right tabular-nums">
              ({(pct * 100).toFixed(1)}%)
            </span>
          </li>
        );
      })}
    </ul>
  );
}
