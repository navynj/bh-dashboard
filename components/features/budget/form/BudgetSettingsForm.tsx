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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

type BudgetSettingsFormProps = {
  initialBudgetRate: number;
  initialReferencePeriodMonths: number;
};

export function BudgetSettingsForm({
  initialBudgetRate,
  initialReferencePeriodMonths,
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
      <CardContent>
        <form
          onSubmit={submit}
          className="flex flex-wrap items-end justify-center gap-4"
        >
          <div className="space-y-2 w-7/15">
            <Label htmlFor="budget-rate">Budget rate (%)</Label>
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
          </div>
          <div className="space-y-2 w-7/15">
            <Label htmlFor="ref-period">Reference period (months)</Label>
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
          </div>
          <Button type="submit" disabled={loading} className="w-47/48">
            {loading ? <Spinner /> : 'Update default settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
