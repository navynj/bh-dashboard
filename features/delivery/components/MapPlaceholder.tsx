'use client';

import { MapPin } from 'lucide-react';
import { format } from 'date-fns';

export type MapPlaceholderProps = {
  /** e.g. "Today's" or "Mar 4's" */
  titleLabel: string;
  /** Subtitle under the title */
  subtitle?: string;
  /** Optional; defaults to "Map view placeholder" */
  placeholderText?: string;
  className?: string;
};

const DEFAULT_SUBTITLE =
  '(To be developed — 지도에 오늘 배송 기사 이동경로 및 현재 위치 표시)';

export function MapPlaceholder({
  titleLabel,
  subtitle = DEFAULT_SUBTITLE,
  placeholderText = 'Map view placeholder',
  className,
}: MapPlaceholderProps) {
  return (
    <div
      className={
        className ??
        'border rounded-lg bg-muted/30 min-h-[400px] flex flex-col'
      }
    >
      <div className="p-4 border-b">
        <h2 className="font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {titleLabel} routes & current position
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8">
        {placeholderText}
      </div>
    </div>
  );
}

/** Helper to build title label from date (e.g. "Today's" or "Mar 4's") */
export function mapPlaceholderTitle(
  isToday: boolean,
  selectedDate: Date,
): string {
  return isToday ? "Today's" : `${format(selectedDate, 'MMM d')}'s`;
}
