/**
 * History Entry Component
 * Individual history entry in the timeline
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { CostHistoryEntry } from '../types';
import {
  getActionIcon,
  getActionLabel,
  getUserDisplayName,
  getUserInitials,
  formatChanges,
} from '../utils/formatting';

interface HistoryEntryProps {
  entry: CostHistoryEntry;
  isLast: boolean;
}

export function HistoryEntry({ entry, isLast }: HistoryEntryProps) {
  const t = useTranslations();
  const changes = formatChanges(entry.log.changes, entry.log.action, t);

  return (
    <div className="relative flex gap-4 pb-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
      )}

      {/* Icon */}
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow">
        {getActionIcon(entry.log.action)}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1 pb-4">
        <div className="pt-1 flex gap-3">
          <Avatar className="h-6 w-6">
            <AvatarImage src={entry.User.image || undefined} />
            <AvatarFallback className="text-xs">
              {getUserInitials(entry.User)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {getUserDisplayName(entry.User, t)}
                </span>
                <span className="text-sm text-gray-600">
                  {getActionLabel(entry.log.action, t)}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {format(new Date(entry.createdAt), 'MMM d, yyyy HH:mm')}
              </span>
            </div>
            {changes && <div className="mt-1 space-y-1">{changes}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

