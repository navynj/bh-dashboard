'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CircleHelp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type LaborRateRefInfoProps = {
  displayRate: number;
  displayPeriod: number;
  targetLabor: number;
  referenceIncomeTotal: number | null;
  className?: string;
};

export function LaborRateRefInfo({
  displayRate,
  displayPeriod,
  targetLabor,
  referenceIncomeTotal,
  className,
}: LaborRateRefInfoProps) {
  const showBreakdown =
    referenceIncomeTotal != null &&
    Number.isFinite(referenceIncomeTotal) &&
    referenceIncomeTotal > 0 &&
    displayPeriod > 0;

  return (
    <p
      className={[
        'text-muted-foreground text-xs inline-flex flex-wrap items-center gap-x-2 gap-y-1',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="inline-flex items-center gap-1">
        <span>Rate</span>
        <span className="text-foreground tabular-nums">
          {(displayRate * 100).toFixed(0)}%
        </span>
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="inline-flex items-center gap-1">
        <span>Ref</span>
        <span className="text-foreground tabular-nums">{displayPeriod} mo</span>
      </span>
      <Dialog>
        <DialogTrigger
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
              {!showBreakdown && (
                <p className="mt-2">
                  When reference income is available, target equals average
                  monthly income over the reference period multiplied by the
                  rate (same inputs as Cost budget).
                </p>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </p>
  );
}
