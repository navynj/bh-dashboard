'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { createReport } from '@/lib/report/createReport';
import { buildTargetPercentages } from '@/lib/report/targetPercentages';
import { ReportTargetInputs } from '@/components/features/report/form/ReportTargetInputs';

export interface PeriodReportFormProps {
  locationCode: string;
  onReportGenerated: () => void;
}

export function PeriodReportForm({
  locationCode,
  onReportGenerated,
}: PeriodReportFormProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [costOfSalesTarget, setCostOfSalesTarget] = useState('');
  const [payrollTarget, setPayrollTarget] = useState('');
  const [profitTarget, setProfitTarget] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!locationCode) return;
    if (!startDate || !endDate) {
      toast.error('Select start and end dates');
      return;
    }
    setGenerating(true);
    try {
      const formatDate = (d: Date) => d.toISOString().slice(0, 10);
      await createReport(
        {
          locationCode,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
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
    startDate,
    endDate,
    costOfSalesTarget,
    payrollTarget,
    profitTarget,
    onReportGenerated,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground',
                )}
                disabled={generating}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {startDate ? format(startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                captionLayout="dropdown"
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <span className="pb-1.5">~</span>
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground',
                )}
                disabled={generating}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {endDate ? format(endDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                captionLayout="dropdown"
                initialFocus
                disabled={(date) => (startDate ? date < startDate : false)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-end">
          <Button
            onClick={handleGenerate}
            disabled={generating || !locationCode || !startDate || !endDate}
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
