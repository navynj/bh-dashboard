'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, getYear } from 'date-fns';
import { FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { SelectedMonth } from '@/lib/report/types';
import { MONTH_NAMES } from '@/constants/date';
import { createReport } from '@/lib/report/createReport';
import { buildTargetPercentages } from '@/lib/report/targetPercentages';
import { ReportTargetInputs } from '@/components/features/report/form/ReportTargetInputs';

export interface MonthlyReportFormProps {
  locationCode: string;
  onReportGenerated: () => void;
}

const monthNames = MONTH_NAMES.map((month) => month.slice(0, 3));

const getYearOptions = () => {
  const currentYear = getYear(new Date());
  return [currentYear, currentYear - 1, currentYear - 2];
};

export function MonthlyReportForm({
  locationCode,
  onReportGenerated,
}: MonthlyReportFormProps) {
  const [selectedYear, setSelectedYear] = useState(() => getYear(new Date()));
  const [selectedMonths, setSelectedMonths] = useState<SelectedMonth[]>([]);
  const [generating, setGenerating] = useState(false);
  const [costOfSalesTarget, setCostOfSalesTarget] = useState('');
  const [payrollTarget, setPayrollTarget] = useState('');
  const [profitTarget, setProfitTarget] = useState('');

  const handleAddMonth = useCallback(
    (month: number) => {
      setSelectedMonths((prev) => {
        if (prev.some((m) => m.year === selectedYear && m.month === month))
          return prev;
        return [...prev, { year: selectedYear, month }];
      });
    },
    [selectedYear],
  );

  const handleRemoveMonth = useCallback((year: number, month: number) => {
    setSelectedMonths((prev) =>
      prev.filter((m) => !(m.year === year && m.month === month)),
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!locationCode) return;
    if (selectedMonths.length === 0 || selectedMonths.length > 3) {
      toast.error('Please select 1 to 3 months');
      return;
    }
    setGenerating(true);
    try {
      await createReport(
        {
          locationCode,
          months: selectedMonths.map((m) => ({
            year: m.year,
            month: m.month + 1,
          })),
          accountingMethod: 'Accrual',
          targetPercentages: buildTargetPercentages(
            costOfSalesTarget,
            payrollTarget,
            profitTarget,
          ),
        },
        { onSuccess: onReportGenerated },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [
    locationCode,
    selectedMonths,
    costOfSalesTarget,
    payrollTarget,
    profitTarget,
    onReportGenerated,
  ]);

  const handleToggleMonth = (month: number) => {
    const isSelected = selectedMonths.some(
      (m) => m.year === selectedYear && m.month === month,
    );
    if (isSelected) {
      handleRemoveMonth(selectedYear, month);
    } else {
      handleAddMonth(month);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between space-y-4">
        <div className="flex flex-col md:flex-row gap-5 items-start ">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">
                Select Year
              </label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Select Month <span className="text-red-500">(Max 3 months)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {monthNames.map((monthName, index) => {
                const monthNumber = index;
                const isSelected = selectedMonths.some(
                  (m) => m.year === selectedYear && m.month === monthNumber,
                );
                const isDisabled = selectedMonths.length >= 3 && !isSelected;

                return (
                  <Button
                    key={monthName}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => handleToggleMonth(monthNumber)}
                    disabled={generating || isDisabled}
                    className="w-fit"
                  >
                    {monthName}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-end">
          <div className="space-y-2 w-[320px]">
            <label className="text-sm font-medium">Selected Months:</label>
            <div className="flex flex-wrap gap-2">
              {selectedMonths.length > 0 ? (
                selectedMonths.map((month) => (
                  <div
                    key={`${month.year}-${month.month}`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md"
                  >
                    <span className="text-sm">
                      {format(new Date(month.year, month.month, 1), 'MMM yyyy')}
                    </span>
                    <button
                      onClick={() => handleRemoveMonth(month.year, month.month)}
                      className="text-muted-foreground hover:text-foreground"
                      disabled={generating}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  No months selected
                </span>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">&nbsp;</label>
          <Button
            onClick={handleGenerate}
            disabled={
              generating || !locationCode || selectedMonths.length === 0
            }
            isLoading={generating}
          >
            <FileText className="h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>
      <ReportTargetInputs
        costOfSalesTarget={costOfSalesTarget}
        payrollTarget={payrollTarget}
        profitTarget={profitTarget}
        onCostOfSalesTargetChange={setCostOfSalesTarget}
        onPayrollTargetChange={setPayrollTarget}
        onProfitTargetChange={setProfitTarget}
        disabled={generating}
      />
    </div>
  );
}
