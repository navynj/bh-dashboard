import { formatCurrency } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { LaborRateRefInfo } from './LaborRateRefInfo';

type LaborSummaryProps = {
  totalLabor: number;
  targetLabor: number;
  displayRate: number;
  displayPeriod: number;
  referenceIncomeTotal: number | null;
  isUpdating: boolean;
};

export default function LaborSummary({
  totalLabor,
  targetLabor,
  displayRate,
  displayPeriod,
  referenceIncomeTotal,
  isUpdating,
}: LaborSummaryProps) {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-medium">Total Labor</span>
        <span className="text-2xl font-extrabold tabular-nums">
          {formatCurrency(totalLabor)}
        </span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <span className="text-muted-foreground text-sm">Target</span>
        <span className="text-muted-foreground text-base tabular-nums">
          {isUpdating ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
            </span>
          ) : (
            formatCurrency(targetLabor)
          )}
        </span>
      </div>
      <LaborRateRefInfo
        displayRate={displayRate}
        displayPeriod={displayPeriod}
        targetLabor={targetLabor}
        referenceIncomeTotal={referenceIncomeTotal}
      />
    </div>
  );
}
