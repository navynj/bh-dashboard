import { Button } from '@/components/ui/button';
import React from 'react';
import { Spinner } from '@/components/ui/spinner';

function UpdateBudgetModal({
  locationId,
  yearMonth,
  onClose,
  onUpdateStart,
  onUpdateSuccess,
  onUpdateError,
}: {
  locationId: string;
  yearMonth: string;
  onClose: () => void;
  onUpdateStart: (rate?: number, period?: number) => void;
  onUpdateSuccess: () => void;
  onUpdateError: () => void;
}) {
  const [rate, setRate] = React.useState('');
  const [period, setPeriod] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    const rateNum = rate ? Number(rate) / 100 : undefined;
    const periodNum = period ? Number(period) : undefined;
    onUpdateStart(rateNum, periodNum);
    try {
      const res = await fetch(`/api/budget/${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth,
          ...(rateNum != null ? { budgetRate: rateNum } : {}),
          ...(periodNum != null ? { referencePeriodMonths: periodNum } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      onUpdateSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      onUpdateError();
      setError(
        e instanceof Error
          ? e.message?.length < 100
            ? e.message
            : 'Update failed'
          : 'Update failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border-border w-full max-w-sm rounded-lg border p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Update budget</h3>
          {yearMonth && (
            <p className="text-muted-foreground text-sm">for {yearMonth}</p>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <label className="text-sm">
            Budget rate{' '}
            <span className="text-muted-foreground text-xs">(% of income)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              placeholder="e.g. 33"
              className="border-input mt-1 w-full rounded border px-2 py-1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Reference period{' '}
            <span className="text-muted-foreground text-xs">(months)</span>
            <input
              type="number"
              min={1}
              max={24}
              placeholder="e.g. 6"
              className="border-input mt-1 w-full rounded border px-2 py-1"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="text-destructive mt-4 text-sm text-right">{error}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Spinner /> : 'Update'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UpdateBudgetButton({
  locationId,
  yearMonth,
  onUpdateStart,
  onUpdateSuccess,
  onUpdateError,
}: {
  locationId: string;
  yearMonth: string;
  onUpdateStart: (rate?: number, period?: number) => void;
  onUpdateSuccess: () => void;
  onUpdateError: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        Update budget
      </Button>
      {open && (
        <UpdateBudgetModal
          locationId={locationId}
          yearMonth={yearMonth}
          onClose={() => setOpen(false)}
          onUpdateStart={onUpdateStart}
          onUpdateSuccess={onUpdateSuccess}
          onUpdateError={onUpdateError}
        />
      )}
    </>
  );
}

export default UpdateBudgetButton;
