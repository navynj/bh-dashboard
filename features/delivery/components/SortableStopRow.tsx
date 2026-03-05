'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  GripVertical,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { DailySchedule, Stop, Task } from '../types/delivery-schedule-types';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'h:mm a') : iso;
}

function isStopCompleted(stop: Stop): boolean {
  if (!stop.departedAt) return false;
  const tasks = stop.tasks ?? [];
  return tasks.every((t) => t.completedAt != null);
}

export function SortableStopRow({
  stop,
  idx,
  schedule,
  onEditStop,
  onDeleteStop,
  defaultCollapsedWhenCompleted = true,
}: {
  stop: Stop;
  idx: number;
  schedule: DailySchedule;
  onEditStop: (schedule: DailySchedule, stopIndex: number) => void;
  onDeleteStop: (schedule: DailySchedule, stopIndex: number) => void;
  /** When true, completed stops (departed + all tasks done) start collapsed. */
  defaultCollapsedWhenCompleted?: boolean;
}) {
  const completed = isStopCompleted(stop);
  const [collapsed, setCollapsed] = useState(
    defaultCollapsedWhenCompleted && completed,
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const taskCount = stop.tasks?.length ?? 0;
  const showCollapseChevron = completed;
  const summaryLine = (chevronAsTrigger: boolean) => (
    <div className="flex items-start gap-2">
      <span
        className="flex h-6 w-6 shrink-0 cursor-grab active:cursor-grabbing touch-none items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-medium"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{stop.name}</p>
        {stop.address && (
          <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            {stop.address}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {stop.arrivedAt && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> Arrived {formatTime(stop.arrivedAt)}
            </span>
          )}
          {stop.departedAt && (
            <span className="flex items-center gap-0.5">
              Departed {formatTime(stop.departedAt)}
            </span>
          )}
          {taskCount > 0 && (
            <span>
              {taskCount} task{taskCount !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>
      {showCollapseChevron &&
        (chevronAsTrigger ? (
          <Collapsible
            open={!collapsed}
            onOpenChange={(o) => setCollapsed(!o)}
          >
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 w-7 p-0"
                aria-label={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </span>
        ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 h-7 w-7 p-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEditStop(schedule, idx);
        }}
        aria-label="Edit stop"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 h-7 w-7 p-0 text-destructive hover:text-destructive"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDeleteStop(schedule, idx);
        }}
        aria-label="Delete stop"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const tasksBlock = stop.tasks && stop.tasks.length > 0 && (
    <ul className="ml-8 mt-2 space-y-1 border-l-2 border-muted pl-2">
      {stop.tasks.map((t: Task) => (
        <li
          key={t.id}
          className={`text-xs flex items-center gap-1.5 ${
            t.completedAt ? 'text-muted-foreground' : ''
          }`}
        >
          {t.completedAt ? (
            <CheckCircle className="h-3 w-3 shrink-0 text-green-600" />
          ) : (
            <Clock className="h-3 w-3 shrink-0" />
          )}
          <span className={t.completedAt ? 'line-through' : ''}>{t.title}</span>
          {t.completedAt && (
            <span className="text-muted-foreground ml-1">
              {formatTime(t.completedAt)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  const collapsible = completed && (
    <Collapsible open={!collapsed} onOpenChange={(o) => setCollapsed(!o)}>
      {collapsed ? (
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left rounded-md hover:bg-muted/50 transition-colors -m-1 p-1"
          >
            {summaryLine(false)}
          </button>
        </CollapsibleTrigger>
      ) : (
        <div className="-m-1 p-1">{summaryLine(true)}</div>
      )}
      <CollapsibleContent>{tasksBlock}</CollapsibleContent>
    </Collapsible>
  );

  if (completed) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex-1 w-full min-w-0 rounded-md border bg-background p-2.5 text-sm"
      >
        {collapsible}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-1 w-full min-w-0 rounded-md border bg-background p-2.5 text-sm"
    >
      {summaryLine(false)}
      {tasksBlock}
    </div>
  );
}
