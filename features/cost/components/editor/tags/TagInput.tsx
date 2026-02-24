'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { TagApiResponse } from '@/features/cost/types/cost';
import { useTagQuery } from '@/features/cost/hooks/queries/useTagQuery';
import Tag from './Tag';
import TagEditDialog from './TagEditDialog';
import { cn } from '@/lib/utils';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TagInputProps {
  tags: TagApiResponse[];
  organizationId: string;
  onChange: (tags: TagApiResponse[]) => void;
  disabled?: boolean;
  className?: string;
}

export default function TagInput({
  tags,
  organizationId,
  onChange,
  disabled = false,
  className,
}: TagInputProps) {
  const t = useTranslations();
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch latest tags to sync with local state
  const { data: allTags = [] } = useTagQuery(organizationId);
  const previousAllTagsRef = useRef<TagApiResponse[]>([]);

  // Sync local tags with latest tag data when tags are updated or deleted
  useEffect(() => {
    // Only sync if allTags actually changed (not just a re-render)
    const allTagsChanged =
      previousAllTagsRef.current.length !== allTags.length ||
      previousAllTagsRef.current.some((prevTag, index) => {
        const currentTag = allTags[index];
        return (
          !currentTag ||
          prevTag.id !== currentTag.id ||
          prevTag.name !== currentTag.name ||
          prevTag.color !== currentTag.color
        );
      });

    if (!allTagsChanged && previousAllTagsRef.current.length > 0) {
      // No changes detected, but update ref for next comparison
      previousAllTagsRef.current = allTags;
      return;
    }

    previousAllTagsRef.current = allTags;

    // Check if any tags in local state need updating or removing
    const updatedTags = tags
      .map((localTag) => {
        const latestTag = allTags.find((t) => t.id === localTag.id);
        // If tag was deleted, filter it out (return null)
        if (!latestTag) {
          return null;
        }
        // If tag was updated (name or color changed), use the latest version
        if (
          latestTag.name !== localTag.name ||
          latestTag.color !== localTag.color
        ) {
          return latestTag;
        }
        return localTag;
      })
      .filter((tag): tag is TagApiResponse => tag !== null);

    // Check if there are changes (tags updated, removed, or count changed)
    const hasChanges =
      updatedTags.length !== tags.length ||
      updatedTags.some((updatedTag, index) => {
        const originalTag = tags[index];
        return (
          !originalTag ||
          updatedTag.name !== originalTag.name ||
          updatedTag.color !== originalTag.color
        );
      });

    if (hasChanges) {
      onChange(updatedTags);
    }
  }, [allTags, tags, onChange]);

  const handleTagConfirm = useCallback(
    (tag: TagApiResponse) => {
      // Check if tag already exists
      const existingIndex = tags.findIndex((t) => t.id === tag.id);

      if (existingIndex >= 0) {
        // Update existing tag
        const newTags = [...tags];
        newTags[existingIndex] = tag;
        onChange(newTags);
      } else {
        // Add new tag
        onChange([...tags, tag]);
      }

      setEditingTagId(null);
    },
    [tags, onChange]
  );

  const handleTagDelete = useCallback(
    (tagId: string) => {
      onChange(tags.filter((t) => t.id !== tagId));
      setEditingTagId('new');
    },
    [tags, onChange]
  );

  const handleAddNew = useCallback(() => {
    setEditingTagId('new');
  }, []);

  const handleNewTagConfirm = useCallback(
    (tag: TagApiResponse) => {
      // Check if tag already exists
      const exists = tags.some((t) => t.id === tag.id);
      if (!exists) {
        onChange([...tags, tag]);
      }
      // After confirming, show a new edit mode for the next tag
      setEditingTagId('new');
    },
    [tags, onChange]
  );

  const handleNewTagCancel = useCallback(() => {
    setEditingTagId(null);
  }, []);

  return (
    <>
      <div
        className={cn(
          'flex flex-wrap gap-2 items-center p-2 bg-gray-50 rounded-md',
          className
        )}
      >
        {/* Existing tags */}
        {tags.map((tag) => (
          <Tag
            key={tag.id}
            tag={tag}
            organizationId={organizationId}
            onConfirm={handleTagConfirm}
            onDelete={handleTagDelete}
            disabled={disabled}
          />
        ))}

        {/* New tag input (always show if no tags or if explicitly adding) */}
        {(editingTagId === 'new' || tags.length === 0) && (
          <Tag
            key={`new-tag-${tags.length}`}
            organizationId={organizationId}
            onConfirm={handleNewTagConfirm}
            onCancel={handleNewTagCancel}
            disabled={disabled}
          />
        )}

        {/* Add new tag button (only show if there are tags and not already adding) */}
        {tags.length > 0 && editingTagId !== 'new' && !disabled && (
          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>+ {t('Cost.addTag')}</span>
          </button>
        )}

        {/* Manage Tags Button */}
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="h-8 px-2 text-gray-500 hover:text-gray-700"
            title={t('Cost.manageAllTags')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tag Edit Dialog */}
      <TagEditDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        organizationId={organizationId}
      />
    </>
  );
}
