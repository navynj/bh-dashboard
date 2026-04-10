import { cn, formatCurrency } from '@/lib/utils';
import { CHART_COLORS } from '@/constants/color';
import type { RevenueCategoryItem } from '../types';

type RevenueCategoryListProps = {
  categories: RevenueCategoryItem[];
  className?: string;
};

function RevenueCategoryList({
  categories,
  className,
}: RevenueCategoryListProps) {
  if (categories.length === 0) return null;

  const total = categories.reduce((s, c) => s + c.amount, 0);

  return (
    <ul className={cn('border-t pt-3 text-sm', className)}>
      {categories.map((c, index) => {
        const pct =
          c.percent != null ? c.percent : total > 0 ? c.amount / total : 0;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        return (
          <li
            key={c.id}
            className="flex items-center gap-2 border-b border-border/60 py-2 last:border-b-0"
          >
            <span
              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: color }}
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {c.name}
            </span>
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

export default RevenueCategoryList;
