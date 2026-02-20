'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CircleHelp } from 'lucide-react';

export type BudgetRateRefInfoProps = {
  displayRate: number | null;
  displayPeriod: number | null;
  /** When true, hide ref when period <= 0 (e.g. summary view). Default false. */
  hideRefWhenZero?: boolean;
  className?: string;
  /** e.g. "text-right" for summary layout */
  textAlignClassName?: string;
};

export function BudgetRateRefInfo({
  displayRate,
  displayPeriod,
  hideRefWhenZero = false,
  className,
  textAlignClassName,
}: BudgetRateRefInfoProps) {
  const showRef =
    displayPeriod != null &&
    (hideRefWhenZero ? displayPeriod > 0 : true);
  const show = displayRate != null || showRef;
  if (!show) return null;

  const text = [
    displayRate != null && `Rate: ${(displayRate * 100).toFixed(0)}%`,
    showRef && displayPeriod != null && `${displayRate != null ? ' · ' : ''}Ref: ${displayPeriod} months`,
  ]
    .filter(Boolean)
    .join('');

  return (
    <p
      className={
        [
          'text-muted-foreground text-xs inline-flex items-center gap-1',
          textAlignClassName,
          className,
        ]
          .filter(Boolean)
          .join(' ')
      }
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
              <h4 className="font-medium text-foreground">Total budget</h4>
              <p>
                The total budget is: <strong>average monthly income × rate</strong>.
                Average monthly income is the reference income (total income over the
                reference period) divided by the number of months in that period. So:
              </p>
              <p className="mt-1 font-mono text-xs">
                Total budget = (Reference income ÷ Ref months) × Rate
              </p>
            </section>
            <section>
              <h4 className="font-medium text-foreground">Category budget</h4>
              <p>
                Each category’s budget is its share of the total budget, based on
                that category’s share of Cost of Sales (COS) in the reference period:
              </p>
              <p className="mt-1 font-mono text-xs">
                Category budget = Total budget × (Category’s reference COS ÷ Total reference COS)
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </p>
  );
}
