'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { CircleHelp } from 'lucide-react';

type LaborRateRefInfoProps = {
  displayRate: number;
  displayPeriod: number;
  targetLabor: number;
  referenceIncomeTotal: number | null;
  className?: string;
  /** e.g. "text-right" for summary layout (matches Cost card) */
  textAlignClassName?: string;
};

export function LaborRateRefInfo({
  displayRate,
  displayPeriod,
  targetLabor,
  referenceIncomeTotal,
  className,
  textAlignClassName,
}: LaborRateRefInfoProps) {
  const showBreakdown =
    referenceIncomeTotal != null &&
    Number.isFinite(referenceIncomeTotal) &&
    referenceIncomeTotal > 0 &&
    displayPeriod > 0;
  const noTarget = displayPeriod <= 0;
  /** Same one-line format as Cost (`BudgetRateRefInfo`): Rate: X% · Ref: Y months */
  const showRef = displayPeriod > 0;
  const text = [
    `Rate: ${(displayRate * 100).toFixed(0)}%`,
    showRef && ` · Ref: ${displayPeriod} months`,
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
          aria-label="How is the labor target calculated?"
        >
          <CircleHelp className="size-3.5" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How labor target is calculated</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <section>
              <h4 className="font-medium text-foreground">
                Target{' '}
                <strong className="font-normal text-muted-foreground text-xs">
                  (average monthly income × rate)
                </strong>
              </h4>
              {showBreakdown && referenceIncomeTotal != null && (
                <p className="mt-2 font-mono text-xs leading-relaxed break-words text-foreground">
                  {formatCurrency(targetLabor)} = (
                  {formatCurrency(referenceIncomeTotal)} ÷ {displayPeriod}) ×{' '}
                  {(displayRate * 100).toFixed(0)}%
                </p>
              )}
              {!showBreakdown && noTarget && (
                <p className="mt-2">
                  When Ref is 0 months, no labor target is set. Rate is still
                  saved for when you set a reference period later.
                </p>
              )}
              {!showBreakdown && !noTarget && (
                <p className="mt-2">
                  When reference income is available, target equals average
                  monthly income over the reference period multiplied by the
                  rate. Labor rate and reference period are separate from the
                  cost budget.
                </p>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </p>
  );
}
