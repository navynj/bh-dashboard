'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

type BudgetSettingsFormProps = {
  initialBudgetRate: number;
  initialReferencePeriodMonths: number;
  /** When true, render without Card wrapper (e.g. inside a dialog). */
  inline?: boolean;
};

export function BudgetSettingsForm({
  initialBudgetRate,
  initialReferencePeriodMonths,
  inline = false,
}: BudgetSettingsFormProps) {
  const [rate, setRate] = React.useState(
    String(Math.round(initialBudgetRate * 100)),
  );
  const [period, setPeriod] = React.useState(
    String(initialReferencePeriodMonths),
  );
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.dismiss();
    setLoading(true);
    try {
      const res = await fetch('/api/budget/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetRate: rate ? Number(rate) / 100 : undefined,
          referencePeriodMonths: period ? Number(period) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      toast.success('Default settings updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setLoading(false);
    }
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(e as unknown as React.FormEvent);
    }
  };

  const formContent = (
    <form
      onSubmit={submit}
      onKeyDown={submitOnEnter}
      className="flex flex-wrap items-end justify-center gap-4"
    >
      <Field className="w-7/15">
        <FieldLabel htmlFor="budget-rate">Budget rate (%)</FieldLabel>
        <Input
          id="budget-rate"
          type="number"
          min={0}
          max={100}
          step={1}
          placeholder="33"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-24 w-full"
        />
      </Field>
      <Field className="w-7/15">
        <FieldLabel htmlFor="ref-period">Reference period (months)</FieldLabel>
        <Input
          id="ref-period"
          type="number"
          min={1}
          max={24}
          placeholder="6"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-24 w-full"
        />
      </Field>
      <Button type="submit" disabled={loading} className="w-47/48">
        {loading ? <Spinner /> : 'Update default settings'}
      </Button>
    </form>
  );

  if (inline) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Budget rate (% of reference income) and reference period (months).
          Used when creating or updating budgets.
        </p>
        {formContent}
      </div>
    );
  }

  return (
    <Card className="md:flex-row gap-4">
      <CardHeader className="md:w-full">
        <CardTitle className="text-base">Default budget settings</CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Budget rate (% of reference income) and reference period (months).
          <br />
          Used when creating or updating budgets.
        </CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
