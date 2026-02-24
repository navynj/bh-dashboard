'use client';

import { useState, useCallback } from 'react';
import { TagApiResponse } from '@/features/cost/types/cost';
import TagBadge from './TagBadge';
import TagEditForm from './TagEditForm';
import { useTagActions } from '../../hooks/filters/useTagActions';

interface TagProps {
  tag?: TagApiResponse;
  organizationId: string;
  onConfirm: (tag: TagApiResponse) => void;
  onDelete?: (tagId: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function Tag({
  tag,
  organizationId,
  onConfirm,
  onDelete,
  onCancel,
  disabled = false,
}: TagProps) {
  const [isEditMode, setIsEditMode] = useState(!tag);

  const { handleCreate, handleUpdate, isCreating, isUpdating } = useTagActions({
    organizationId,
    onConfirm: (confirmedTag) => {
      onConfirm(confirmedTag);
      setIsEditMode(false);
    },
    // onDelete is not used here - we only remove from cost, not delete tag
  });

  const handleCancel = useCallback(() => {
    setIsEditMode(false);
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const handleFormConfirm = useCallback(
    async (name: string, color: string) => {
      if (tag) {
        await handleUpdate(tag.id, name, color);
      } else {
        await handleCreate(name, color);
      }
    },
    [tag, handleCreate, handleUpdate]
  );

  const handleSelectExistingTag = useCallback(
    (selectedTag: TagApiResponse) => {
      // When selecting an existing tag, directly use it without creating a new one
      onConfirm(selectedTag);
      setIsEditMode(false);
    },
    [onConfirm]
  );

  const handleDeleteClick = useCallback(() => {
    if (tag && onDelete) {
      // Just remove the tag from the cost, don't delete the tag itself
      onDelete(tag.id);
    }
  }, [tag, onDelete]);

  // If not in edit mode and tag exists, show tag badge
  if (!isEditMode && tag) {
    return (
      <TagBadge
        tag={tag}
        onDelete={onDelete ? handleDeleteClick : undefined}
        disabled={disabled}
      />
    );
  }

  // Edit mode
  return (
    <TagEditForm
      tag={tag}
      organizationId={organizationId}
      onConfirm={handleFormConfirm}
      onSelectExistingTag={!tag ? handleSelectExistingTag : undefined}
      onCancel={handleCancel}
      disabled={disabled || isCreating || isUpdating}
    />
  );
}
