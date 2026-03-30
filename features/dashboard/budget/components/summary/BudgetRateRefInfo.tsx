'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CircleHelp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export type BudgetRateRefInfoProps = {
  displayRate: number | null;
  displayPeriod: number | null;
  /** Total budget (same as card summary) for the “?” breakdown. */
  totalBudget?: number;
  /** Reference-period income total over Ref months (from QuickBooks). */
  referenceIncomeTotal?: number;
  /** When true, hide ref when period <= 0 (e.g. summary view). Default false. */
  hideRefWhenZero?: boolean;
  className?: string;
  /** e.g. "text-right" for summary layout */
  textAlignClassName?: string;
};

export function BudgetRateRefInfo({
  displayRate,
  displayPeriod,
  totalBudget,
  referenceIncomeTotal,
  hideRefWhenZero = false,
  className,
  textAlignClassName,
}: BudgetRateRefInfoProps) {
  const showRef =
    displayPeriod != null && (hideRefWhenZero ? displayPeriod > 0 : true);
  const show = displayRate != null || showRef;
  if (!show) return null;

  const showBreakdown =
    typeof totalBudget === 'number' &&
    Number.isFinite(totalBudget) &&
    typeof referenceIncomeTotal === 'number' &&
    Number.isFinite(referenceIncomeTotal) &&
    displayPeriod != null &&
    displayPeriod > 0 &&
    displayRate != null;

  const text = [
    displayRate != null && `Rate: ${(displayRate * 100).toFixed(0)}%`,
    showRef &&
      displayPeriod != null &&
      `${displayRate != null ? ' · ' : ''}Ref: ${displayPeriod} months`,
  ]
    .filter(Boolean)
    .join('');

  return (
    <p
      className={[
        'text-muted-foreground text-xs inline-flex items-center gap-1',
        textAlignClassName,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span>{text}</span>
      <Dialog>
        <DialogTrigger
          type="button"
          className="inline-flex shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="How is the budget calculated?"
        >
          <CircleHelp className="size-3.5" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How budget is calculated</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <section>
              <h4 className="font-medium text-foreground">
                Total budget{' '}
                <strong className="font-normal text-muted-foreground text-xs">
                  (average monthly income × rate)
                </strong>
              </h4>
              {showBreakdown &&
                totalBudget != null &&
                referenceIncomeTotal != null &&
                displayRate != null &&
                displayPeriod != null && (
                  <p className="mt-2 font-mono text-xs leading-relaxed break-words text-foreground">
                    {formatCurrency(totalBudget)} = (
                    {formatCurrency(referenceIncomeTotal)} ÷ {displayPeriod}) ×{' '}
                    {(displayRate * 100).toFixed(0)}%
                  </p>
                )}
            </section>
            <section>
              <h4 className="font-medium text-foreground">Category budget</h4>
              <p>
                Each category’s budget is its share of the total budget, based
                on that category’s share of Cost of Sales (COS) in the reference
                period:
              </p>
              <p className="mt-1 font-mono text-xs">
                Category budget = Total budget × (Category’s reference COS ÷
                Total reference COS)
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </p>
  );
}
