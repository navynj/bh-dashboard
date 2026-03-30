'use client';

import { BudgetSettingsForm } from '@/features/dashboard/budget/components/form/BudgetSettingsForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';

type BudgetSettingsDialogProps = {
  initialBudgetRate: number;
  initialReferencePeriodMonths: number;
};

export function BudgetSettingsDialog({
  initialBudgetRate,
  initialReferencePeriodMonths,
}: BudgetSettingsDialogProps) {
  const pathname = usePathname();
  const isBudgetPage = pathname === '/dashboard/budget';
  if (!isBudgetPage) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Budget settings">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Default Budget Settings</DialogTitle>
        <BudgetSettingsForm
          initialBudgetRate={initialBudgetRate}
          initialReferencePeriodMonths={initialReferencePeriodMonths}
          inline
        />
      </DialogContent>
    </Dialog>
  );
}
