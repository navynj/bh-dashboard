'use client';

import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TagApiResponse } from '@/features/cost/types/cost';
import { getColorClassName } from './TagColorPicker';

interface TagBadgeProps {
  tag: TagApiResponse;
  onDelete?: () => void;
  className?: string;
  disabled?: boolean;
}

export default function TagBadge({
  tag,
  onDelete,
  className,
  disabled = false,
}: TagBadgeProps) {
  const t = useTranslations();
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-white font-bold',
        getColorClassName(tag.color),
        disabled && 'opacity-50',
        className
      )}
    >
      <span>{tag.name}</span>
      {!disabled && (
        <>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="hover:bg-black/20 rounded p-0.5 transition-colors"
              aria-label={t('Cost.deleteTagAriaLabel')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
