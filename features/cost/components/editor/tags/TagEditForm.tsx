'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TagColorPicker from './TagColorPicker';
import TagSearchDropdown from './TagSearchDropdown';
import { TagApiResponse } from '@/features/cost/types/cost';
import { useTagQuery } from '@/features/cost/hooks/queries/useTagQuery';
import { useDebouncedSearch } from '../../hooks/filters/useTagSearch';
import { cn } from '@/lib/utils';

interface TagEditFormProps {
  tag?: TagApiResponse;
  organizationId: string;
  onConfirm: (name: string, color: string) => void;
  onSelectExistingTag?: (tag: TagApiResponse) => void;
  onCancel?: () => void;
  isFullWidth?: boolean;
  className?: string;
  disabled?: boolean;
  disableSearch?: boolean;
}

export default function TagEditForm({
  tag,
  organizationId,
  onConfirm,
  onSelectExistingTag,
  onCancel,
  className,
  isFullWidth = false,
  disabled = false,
  disableSearch = false,
}: TagEditFormProps) {
  const t = useTranslations();
  const [name, setName] = useState(tag?.name || '');
  const [color, setColor] = useState(tag?.color || 'gray');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allTags = [] } = useTagQuery(organizationId);
  const {
    searchQuery,
    debouncedSearch,
    cancel: cancelDebouncedSearch,
  } = useDebouncedSearch();

  // Filter matching tags
  const matchingTags = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return allTags.filter(
      (t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) &&
        t.id !== tag?.id
    );
  }, [allTags, searchQuery, tag?.id]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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

  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);
      if (!disableSearch) {
        debouncedSearch(value);
        setShowDropdown(value.trim().length > 0);
      }
    },
    [debouncedSearch, disableSearch]
  );

  const handleSelectTag = useCallback(
    (selectedTag: TagApiResponse) => {
      // If onSelectExistingTag is provided, use it to pass the full tag object
      // Otherwise, fall back to onConfirm with name and color
      if (onSelectExistingTag) {
        onSelectExistingTag(selectedTag);
      } else {
        onConfirm(selectedTag.name, selectedTag.color);
      }
      setName('');
      cancelDebouncedSearch();
      setShowDropdown(false);
    },
    [onConfirm, onSelectExistingTag, cancelDebouncedSearch]
  );

  const handleConfirm = useCallback(() => {
    if (name.trim()) {
      onConfirm(name.trim(), color);
    }
  }, [name, color, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && name.trim()) {
        e.preventDefault();
        if (matchingTags.length > 0 && showDropdown) {
          // Select first matching tag and immediately confirm
          handleSelectTag(matchingTags[0]);
        } else {
          handleConfirm();
        }
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        if (onCancel) {
          onCancel();
        }
      }
    },
    [name, matchingTags, showDropdown, handleSelectTag, handleConfirm, onCancel]
  );

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-block', isFullWidth && 'w-full')}
    >
      <div className={cn('flex items-center gap-1', isFullWidth && 'w-full')}>
        <div className={cn('relative', isFullWidth && 'w-full')}>
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() =>
              !disableSearch && setShowDropdown(name.trim().length > 0)
            }
            placeholder={t('Cost.enterTagName')}
            disabled={disabled}
            className={cn('w-44 pr-14', isFullWidth && 'w-full', className)}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={handleConfirm}
            disabled={disabled || !name.trim()}
            size="sm"
            className="h-6 px-1 absolute right-2 top-1/2 -translate-y-1/2"
          >
            <Check className="h-3 w-3" />
          </Button>

          <TagColorPicker
            color={color}
            onColorChange={setColor}
            disabled={disabled}
            className="absolute right-8.5 top-1/2 -translate-y-1/2"
          />

          {!disableSearch && showDropdown && (
            <TagSearchDropdown
              matchingTags={matchingTags}
              searchQuery={searchQuery}
              selectedColor={color}
              onSelectTag={handleSelectTag}
              onCreateNew={handleConfirm}
            />
          )}
        </div>

        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            variant="ghost"
            size="sm"
            className="h-6 px-2"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
