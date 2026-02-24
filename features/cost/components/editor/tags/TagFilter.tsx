'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { TagApiResponse } from '@/features/cost/types/cost';
import { useTagQuery } from '@/features/cost/hooks/queries/useTagQuery';
import { useDebouncedSearch } from '../../hooks/filters/useTagSearch';
import TagBadge from './TagBadge';
import { getColorClassName } from './TagColorPicker';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface TagFilterProps {
  selectedTagIds: string[];
  organizationId: string;
  onTagIdsChange: (tagIds: string[]) => void;
  className?: string;
}

export default function TagFilter({
  selectedTagIds,
  organizationId,
  onTagIdsChange,
  className,
}: TagFilterProps) {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allTags = [] } = useTagQuery(organizationId);
  const {
    searchQuery: debouncedQuery,
    debouncedSearch,
    cancel: cancelDebouncedSearch,
  } = useDebouncedSearch();

  // Get selected tags
  const selectedTags = useMemo(() => {
    return allTags.filter((tag) => selectedTagIds.includes(tag.id));
  }, [allTags, selectedTagIds]);

  // Filter matching tags (exclude already selected ones)
  const matchingTags = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return allTags.filter(
      (t) =>
        t.name.toLowerCase().includes(debouncedQuery.toLowerCase().trim()) &&
        !selectedTagIds.includes(t.id)
    );
  }, [allTags, debouncedQuery, selectedTagIds]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      debouncedSearch(value);
      setShowDropdown(value.trim().length > 0);
    },
    [debouncedSearch]
  );

  const handleSelectTag = useCallback(
    (tag: TagApiResponse) => {
      if (!selectedTagIds.includes(tag.id)) {
        onTagIdsChange([...selectedTagIds, tag.id]);
      }
      setSearchQuery('');
      cancelDebouncedSearch();
      setShowDropdown(false);
      // Blur first to allow Input component to sync the value, then focus
      if (inputRef.current) {
        inputRef.current.blur();
        // Use setTimeout to ensure blur completes before setting value and focusing
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.value = '';
            inputRef.current.focus();
          }
        }, 0);
      }
    },
    [selectedTagIds, onTagIdsChange, cancelDebouncedSearch]
  );

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      onTagIdsChange(selectedTagIds.filter((id) => id !== tagId));
    },
    [selectedTagIds, onTagIdsChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && matchingTags.length > 0 && showDropdown) {
        e.preventDefault();
        // Select first matching tag
        handleSelectTag(matchingTags[0]);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        setSearchQuery('');
        cancelDebouncedSearch();
      }
    },
    [matchingTags, showDropdown, handleSelectTag, cancelDebouncedSearch]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-wrap gap-2 items-center h-9 p-1 bg-gray-50 rounded-md border',
        className
      )}
    >
      {/* Selected tags */}
      {selectedTags.map((tag) => (
        <TagBadge
          key={tag.id}
          tag={tag}
          onDelete={() => handleRemoveTag(tag.id)}
          className="h-6"
        />
      ))}

      {/* Search input */}
      <div className="relative inline-block flex-1">
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() =>
            setShowDropdown(
              searchQuery.trim().length > 0 || matchingTags.length > 0
            )
          }
          placeholder={t('Cost.enterTagName')}
          className="w-full h-6"
        />

        {/* Dropdown */}
        {showDropdown && matchingTags.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            <div className="p-1">
              {matchingTags.map((matchingTag) => (
                <button
                  key={matchingTag.id}
                  type="button"
                  onClick={() => handleSelectTag(matchingTag)}
                  className="w-full text-left px-3 hover:bg-gray-100 rounded flex items-center gap-2"
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
          </div>
        )}
      </div>
    </div>
  );
}
