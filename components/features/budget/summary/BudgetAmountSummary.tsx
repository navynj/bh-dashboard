import { formatCurrency } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

type BudgetAmountSummaryProps = {
  isUpdating: boolean;
  needsReconnect: boolean;
  currentCosTotal: number;
  totalBudget: number;
  displayRate: number | null;
  displayPeriod: number | null;
};

function BudgetAmountSummary({
  isUpdating,
  needsReconnect,
  currentCosTotal,
  totalBudget,
  displayRate,
  displayPeriod,
}: BudgetAmountSummaryProps) {
  const noReference = displayPeriod != null && displayPeriod <= 0;
  return (
    <>
      <div className="text-2xl font-semibold">
        {isUpdating ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Spinner className="size-5 " />
            <span>Updating…</span>
          </span>
        ) : (
          !needsReconnect && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-normal">Cost of Sales</p>
                <p className="text-muted-foreground text-base font-normal">
                  {noReference ? 'No budget set' : 'Budget'}
                </p>
              </div>
              <div className="inline-flex flex-col items-end">
                <p className="font-extrabold">
                  {formatCurrency(currentCosTotal)}
                </p>
                <p className="text-muted-foreground text-base font-normal">
                  {noReference ? '—' : `/${formatCurrency(totalBudget)}`}
                </p>
              </div>
            </div>
          )
        )}
      </div>
      {(displayRate != null || (displayPeriod != null && !noReference)) && (
        <p className="text-muted-foreground text-xs text-right">
          {displayRate != null && `Rate: ${(displayRate * 100).toFixed(0)}%`}
          {displayPeriod != null &&
            displayPeriod > 0 &&
            `${displayRate != null ? ' · ' : ''}Ref: ${displayPeriod} months`}
        </p>
      )}
    </>
  );
}

export default BudgetAmountSummary;
