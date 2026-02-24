'use client';

import { useTranslations } from 'next-intl';
import { TagApiResponse } from '@/features/cost/types/cost';
import { getColorClassName } from './TagColorPicker';
import { cn } from '@/lib/utils';

interface TagSearchDropdownProps {
  matchingTags: TagApiResponse[];
  searchQuery: string;
  selectedColor: string;
  onSelectTag: (tag: TagApiResponse) => void;
  onCreateNew: () => void;
}

export default function TagSearchDropdown({
  matchingTags,
  searchQuery,
  selectedColor,
  onSelectTag,
  onCreateNew,
}: TagSearchDropdownProps) {
  const t = useTranslations();
  if (matchingTags.length === 0 && !searchQuery.trim()) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
      {matchingTags.length > 0 && (
        <div className="p-1">
          {matchingTags.map((matchingTag) => (
            <button
              key={matchingTag.id}
              type="button"
              onClick={() => onSelectTag(matchingTag)}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full',
                  getColorClassName(matchingTag.color)
                )}
              />
              <span>{matchingTag.name}</span>
            </button>
          ))}
        </div>
      )}
      {searchQuery.trim() && (
        <>
          {matchingTags.length > 0 && (
            <div className="border-t border-gray-200 my-1" />
          )}
          <div className="p-1">
            <button
              type="button"
              onClick={onCreateNew}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full',
                  getColorClassName(selectedColor)
                )}
              />
              <span>{t('Cost.createTag', { name: searchQuery.trim() })}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
