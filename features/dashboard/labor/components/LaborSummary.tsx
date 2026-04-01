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
  const noTarget = displayPeriod <= 0;
  return (
    <>
      <div className="text-2xl font-semibold">
        {isUpdating ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Spinner className="size-5 " />
            <span>Updating…</span>
          </span>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-normal">Total Labor</p>
              <p className="text-muted-foreground text-base font-normal">
                {noTarget ? 'No target set' : 'Target'}
              </p>
            </div>
            <div className="inline-flex flex-col items-end">
              <p className="font-extrabold tabular-nums">
                {formatCurrency(totalLabor)}
              </p>
              <p className="text-muted-foreground text-base font-normal tabular-nums">
                {noTarget ? '—' : `/${formatCurrency(targetLabor)}`}
              </p>
            </div>
          </div>
        )}
      </div>
      <LaborRateRefInfo
        displayRate={displayRate}
        displayPeriod={displayPeriod}
        targetLabor={targetLabor}
        referenceIncomeTotal={referenceIncomeTotal}
        textAlignClassName="text-right"
      />
    </>
  );
}
