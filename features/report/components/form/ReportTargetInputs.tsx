'use client';

import { Input } from '@/components/ui/input';

export interface ReportTargetInputsProps {
  costOfSalesTarget: string;
  payrollTarget: string;
  profitTarget: string;
  onCostOfSalesTargetChange: (value: string) => void;
  onPayrollTargetChange: (value: string) => void;
  onProfitTargetChange: (value: string) => void;
  disabled?: boolean;
}

export function ReportTargetInputs({
  costOfSalesTarget,
  payrollTarget,
  profitTarget,
  onCostOfSalesTargetChange,
  onPayrollTargetChange,
  onProfitTargetChange,
  disabled = false,
}: ReportTargetInputsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
      <div>
        <label className="text-sm font-medium mb-2 block">
          Cost of Sales Target (%)
        </label>
        <Input
          type="number"
          value={costOfSalesTarget}
          onChange={(e) => onCostOfSalesTargetChange(e.target.value)}
          placeholder="e.g., 30.0"
          disabled={disabled}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">
          Payroll Target (%)
        </label>
        <Input
          type="number"
          value={payrollTarget}
          onChange={(e) => onPayrollTargetChange(e.target.value)}
          placeholder="e.g., 25.0"
          disabled={disabled}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">
          Profit Target (%)
        </label>
        <Input
          type="number"
          value={profitTarget}
          onChange={(e) => onProfitTargetChange(e.target.value)}
          placeholder="e.g., 15.0"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
