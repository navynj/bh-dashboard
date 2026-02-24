'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { dialogAtom } from '@/store/ui';
import { format } from 'date-fns';
import { useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export interface MemoType {
  id: string;
  memo: string;
  userId: string;
  user?: {
    name?: string | null;
    email?: string | null;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface MemoProps {
  memo: MemoType;
  isLast: boolean;
  onEdit: (id: string, newMemo: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
  allowDelete?: boolean; // Allow delete even when disabled (for pending memos)
}

const Memo = ({
  memo,
  isLast,
  onEdit,
  onDelete,
  disabled,
  allowDelete = false,
}: MemoProps) => {
  const t = useTranslations();
  const setDialog = useSetAtom(dialogAtom);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(memo.memo);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (editValue.trim() === memo.memo.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onEdit(memo.id, editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update memo:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(memo.memo);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if ((disabled && !allowDelete) || isDeleting) return;

    setDialog({
      show: true,
      title:
        t('Cost.deleteMemoConfirm') ||
        'Are you sure you want to delete this memo?',
      description: t('UI.thisActionCannotBeUndone'),
      showCancel: true,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await onDelete(memo.id);
        } catch (error) {
          console.error('Failed to delete memo:', error);
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const userName = memo.user?.name || memo.user?.email || 'Unknown';

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute top-0 left-[0.33rem] w-0.25 bg-gray-300 bottom-0" />
      )}
      <div className="relative flex gap-4 pb-4">
        {/* Timeline line and bullet */}
        <div className="relative flex flex-col items-center min-w-[12px]">
          <div className="w-2 h-2 rounded-full bg-gray-400 z-10 relative" />
        </div>

        {/* Memo content */}
        <div className="flex-1 bg-white rounded-lg p-4 shadow-sm min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSave();
                  } else if (e.key === 'Escape') {
                    handleCancel();
                  }
                }}
                disabled={isSaving}
                className="w-full"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving || disabled}
                >
                  {t('UI.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  isLoading={isSaving}
                  disabled={disabled}
                >
                  {t('UI.save')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                {memo.memo}
              </p>
              <div className="grid grid-cols-[1fr_auto] text-xs text-gray-500 gap-2">
                <div className="flex items-center gap-2 col-span-2">
                  <span>{userName}</span>
                </div>
                <span>
                  {format(new Date(memo.createdAt), 'MMM d, yyyy HH:mm')}
                  {(() => {
                    const created = new Date(memo.createdAt).getTime();
                    const updated = new Date(memo.updatedAt).getTime();
                    // Only show (edited) if updated is significantly different from created (more than 1 second)
                    return updated - created > 1000 ? ' (edited)' : '';
                  })()}
                </span>
                {(!disabled || allowDelete) && (
                  <div className="flex gap-2">
                    {!memo.id.startsWith('pending-') && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {t('UI.update')}
                      </button>
                    )}
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {isDeleting ? t('UI.deleting') : t('UI.delete')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Memo;
