import { formatCurrency } from '@/lib/utils';
import { formatPercent } from './helpers';

function AmountPercent({
  amount,
  percent,
  className = '',
}: {
  amount: unknown;
  percent: number | null;
  className?: string;
}) {
  const percentText = formatPercent(percent);
  return (
    <span
      className={`inline-grid grid-cols-[7.25rem_3.75rem] items-center text-right tabular-nums ${className}`}
    >
      <span>{formatCurrency(Number(amount))}</span>
      <span className="text-muted-foreground text-xs">
        {percentText ? `(${percentText})` : ''}
      </span>
    </span>
  );
}

export default AmountPercent;
