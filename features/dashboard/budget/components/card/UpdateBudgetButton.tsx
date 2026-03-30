import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import React from 'react';

function UpdateBudgetModal({
  locationId,
  yearMonth,
  currentBudgetRate,
  currentReferencePeriodMonths,
  onClose,
  onUpdateStart,
  onUpdateSuccess,
  onUpdateError,
}: {
  locationId: string;
  yearMonth: string;
  currentBudgetRate?: number | null;
  currentReferencePeriodMonths?: number | null;
  onClose: () => void;
  onUpdateStart: (rate?: number, period?: number) => void;
  onUpdateSuccess: () => void;
  onUpdateError: () => void;
}) {
  const [rate, setRate] = React.useState(() =>
    currentBudgetRate != null && Number.isFinite(currentBudgetRate)
      ? String(Math.round(currentBudgetRate * 100))
      : '',
  );
  const [period, setPeriod] = React.useState(() =>
    currentReferencePeriodMonths != null &&
    Number.isFinite(currentReferencePeriodMonths)
      ? String(currentReferencePeriodMonths)
      : '',
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    const rateNum = rate ? Number(rate) / 100 : undefined;
    const periodNum = period ? Number(period) : undefined;
    onUpdateStart(rateNum, periodNum);
    try {
      let defaultBudgetRate: number | undefined;
      let defaultReferencePeriodMonths: number | undefined;
      const settingsRes = await fetch('/api/budget/settings');
      if (settingsRes.ok) {
        const { settings } = await settingsRes.json();
        if (settings) {
          defaultBudgetRate =
            typeof settings.budgetRate === 'number'
              ? settings.budgetRate
              : undefined;
          defaultReferencePeriodMonths =
            typeof settings.referencePeriodMonths === 'number'
              ? settings.referencePeriodMonths
              : undefined;
        }
      }

      const res = await fetch(`/api/budget/${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth,
          ...(rateNum != null
            ? { budgetRate: rateNum }
            : { budgetRate: defaultBudgetRate }),
          ...(periodNum != null
            ? { referencePeriodMonths: periodNum }
            : { referencePeriodMonths: defaultReferencePeriodMonths }),
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        onKeyDown={submitOnEnter}
        className="bg-background border-border w-full max-w-sm rounded-lg border p-4 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Update budget</h3>
          {yearMonth && (
            <p className="text-muted-foreground text-sm">for {yearMonth}</p>
          )}
        </div>
        <div className="mt-3 space-y-4">
          <Field>
            <FieldLabel htmlFor="update-budget-rate">
              Budget rate{' '}
              <span className="text-muted-foreground text-xs font-normal">
                (% of income)
              </span>
            </FieldLabel>
            <Input
              id="update-budget-rate"
              type="number"
              min={0}
              max={100}
              step={1}
              placeholder="e.g. 30"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="update-budget-period">
              Reference period{' '}
              <span className="text-muted-foreground text-xs font-normal">
                (months)
              </span>
            </FieldLabel>
            <Input
              id="update-budget-period"
              type="number"
              min={0}
              max={24}
              placeholder="e.g. 6"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </Field>
        </div>
        {error && <FieldError className="mt-4 text-right">{error}</FieldError>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Spinner /> : 'Update'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function UpdateBudgetButton({
  locationId,
  yearMonth,
  currentBudgetRate,
  currentReferencePeriodMonths,
  onUpdateStart,
  onUpdateSuccess,
  onUpdateError,
}: {
  locationId: string;
  yearMonth: string;
  currentBudgetRate?: number | null;
  currentReferencePeriodMonths?: number | null;
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
          currentBudgetRate={currentBudgetRate}
          currentReferencePeriodMonths={currentReferencePeriodMonths}
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
