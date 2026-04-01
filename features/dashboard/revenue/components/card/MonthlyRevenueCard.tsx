'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import RevenueChart from '../chart/RevenueChart';
import RevenueSummary from '../chart/RevenueSummary';
import RevenueCategoryList from '../list/RevenueCategoryList';
import type { RevenuePeriodData } from '../types';

type MonthlyRevenueCardProps = {
  data: RevenuePeriodData;
  className?: string;
};

const MonthlyRevenueCard = ({ data, className }: MonthlyRevenueCardProps) => {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <div className="rounded-lg border bg-background/80 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  !open && '-rotate-90',
                )}
                aria-hidden
              />
              <span>Monthly</span>
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="overflow-hidden">
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-4">
              <RevenueSummary
                totalRevenue={data.totalRevenue}
                targetRevenue={data.targetRevenue}
              />
              <RevenueChart categories={data.categories} />
            </div>
            <RevenueCategoryList categories={data.categories} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default MonthlyRevenueCard;
