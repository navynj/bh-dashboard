'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSetAtom } from 'jotai';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import TagEditForm from './TagEditForm';
import { TagApiResponse } from '@/features/cost/types/cost';
import {
  useTagQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} from '@/features/cost/hooks/queries/useTagQuery';
import { getColorClassName } from './TagColorPicker';
import { cn } from '@/lib/utils';
import { X, Plus, Pencil } from 'lucide-react';
import { Spinner } from '@shopify/polaris';
import { dialogAtom } from '@/store/ui';

interface TagEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export default function TagEditDialog({
  open,
  onOpenChange,
  organizationId,
}: TagEditDialogProps) {
  const t = useTranslations();
  const setDialog = useSetAtom(dialogAtom);
  const { data: tags = [], isLoading } = useTagQuery(organizationId);
  const createMutation = useCreateTagMutation();
  const updateMutation = useUpdateTagMutation();
  const deleteMutation = useDeleteTagMutation();

  const [editingTags, setEditingTags] = useState<Set<string>>(new Set());
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const handleEditStart = useCallback((tag: TagApiResponse) => {
    setEditingTags((prev) => {
      const next = new Set(prev);
      next.add(tag.id);
      return next;
    });
  }, []);

  const handleEditCancel = useCallback((tagId: string) => {
    setEditingTags((prev) => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });
  }, []);

  const handleSave = useCallback(
    async (tagId: string, name: string, color: string) => {
      if (!name.trim()) return;

      try {
        await updateMutation.mutateAsync({
          organizationId,
          tagId,
          name: name.trim(),
          color,
        });
        setEditingTags((prev) => {
          const next = new Set(prev);
          next.delete(tagId);
          return next;
        });
      } catch (error) {
        console.error('Failed to update tag:', error);
      }
    },
    [organizationId, updateMutation]
  );

  const handleDelete = useCallback(
    (tag: TagApiResponse) => {
      setDialog({
        show: true,
        title: t('Cost.deleteTagConfirm', { name: tag.name }),
        description: t('Cost.deleteTagDescription', { name: tag.name }),
        showCancel: true,
        onConfirm: async () => {
          try {
            await deleteMutation.mutateAsync({
              organizationId,
              tagId: tag.id,
            });
          } catch (error) {
            console.error('Failed to delete tag:', error);
          }
        },
      });
    },
    [organizationId, deleteMutation, t, setDialog]
  );

  const handleCreateNew = useCallback(() => {
    setIsCreatingNew(true);
  }, []);

  const handleCreateCancel = useCallback(() => {
    setIsCreatingNew(false);
  }, []);

  const handleCreateConfirm = useCallback(
    async (name: string, color: string) => {
      try {
        await createMutation.mutateAsync({
          organizationId,
          name,
          color,
        });
        setIsCreatingNew(false);
      } catch (error) {
        console.error('Failed to create tag:', error);
      }
    },
    [organizationId, createMutation]
  );

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('Cost.manageTags')}</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-gray-500">
            <Spinner />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        xClassName="top-3 right-3"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-6">
          <DialogTitle>{t('Cost.manageTags')}</DialogTitle>
          {!isCreatingNew && (
            <Button type="button" onClick={handleCreateNew} size="sm">
              <Plus className="h-4 w-4" />
              {t('Cost.addNewTag')}
            </Button>
          )}
        </DialogHeader>

        <div className="space-y-3">
          {/* Existing Tags */}
          {tags.map((tag) => {
            const isEditing = editingTags.has(tag.id);

            if (isEditing) {
              return (
                <div
                  key={tag.id}
                  className="p-3 border border-gray-200 bg-gray-50 rounded-md"
                >
                  <TagEditForm
                    tag={tag}
                    organizationId={organizationId}
                    onConfirm={(name, color) => handleSave(tag.id, name, color)}
                    onCancel={() => handleEditCancel(tag.id)}
                    disabled={updateMutation.isPending}
                    isFullWidth={true}
                    disableSearch={true}
                  />
                </div>
              );
            }

            return (
              <div
                key={tag.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full flex-shrink-0',
                    getColorClassName(tag.color)
                  )}
                />
                <span className="flex-1 font-medium">{tag.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleEditStart(tag)}
                  size="icon"
                  className="text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDelete(tag)}
                  disabled={deleteMutation.isPending}
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          {/* New Tag Form */}
          {isCreatingNew && (
            <div className="p-3 border border-gray-200 bg-gray-50 rounded-md">
              <TagEditForm
                organizationId={organizationId}
                onConfirm={handleCreateConfirm}
                onCancel={handleCreateCancel}
                disabled={createMutation.isPending}
                isFullWidth={true}
                disableSearch={true}
              />
            </div>
          )}

          {/* Empty State */}
          {tags.length === 0 && !isCreatingNew && (
            <div className="text-center py-8 text-gray-500">
              {t('Cost.noTagsYet')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
