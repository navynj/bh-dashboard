'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export type DeliveryDatePickerProps = {
  dateStr: string;
  setDateStr: (s: string) => void;
  selectedDate: Date;
  isToday: boolean;
  goPrevDay: () => void;
  goNextDay: () => void;
  weekDays: Date[];
  isSameDay: (a: Date, b: Date) => boolean;
};

export function DeliveryDatePicker({
  dateStr,
  setDateStr,
  selectedDate,
  goPrevDay,
  goNextDay,
  weekDays,
  isSameDay,
}: DeliveryDatePickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={goPrevDay}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-2xl sm:text-3xl font-semibold text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded px-2 py-1"
              aria-label="Pick date"
            >
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) setDateStr(format(d, 'yyyy-MM-dd'));
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={goNextDay}
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
        {weekDays.map((d) => {
          const dayStr = format(d, 'yyyy-MM-dd');
          const selected = isSameDay(d, selectedDate);
          return (
            <Button
              key={dayStr}
              variant={selected ? 'default' : 'outline'}
              size="sm"
              className="min-w-[4rem] h-10"
              onClick={() => setDateStr(dayStr)}
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="text-[10px] sm:text-xs opacity-80">
                  {format(d, 'EEE')}
                </span>
                <span className="text-sm font-semibold">{format(d, 'd')}</span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
