'use client';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useUserQuery } from '@/features/user/hooks/useUserQuery';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import Memo, { MemoType } from './Memo';

interface MemoAreaProps {
  costId?: string;
  organizationId: string;
  disabled?: boolean;
  onPendingMemosChange?: (pendingMemos: string[]) => void;
  pendingMemosRef?: React.MutableRefObject<string[] | null>;
}

const MemoArea = ({
  costId,
  organizationId,
  disabled,
  onPendingMemosChange,
  pendingMemosRef,
}: MemoAreaProps) => {
  const t = useTranslations();
  const { data: user } = useUserQuery();
  const [memos, setMemos] = useState<MemoType[]>([]);
  const [pendingMemos, setPendingMemos] = useState<string[]>([]);
  const [newMemo, setNewMemo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Expose pending memos via ref
  useEffect(() => {
    if (pendingMemosRef) {
      pendingMemosRef.current = pendingMemos;
    }
  }, [pendingMemos, pendingMemosRef]);

  // Note: Pending memos are saved in costSubmitHandler before redirect
  // This useEffect is kept as a backup for edge cases (e.g., if costId changes without redirect)
  useEffect(() => {
    if (costId && pendingMemos.length > 0 && organizationId) {
      const savePendingMemos = async () => {
        // Capture current pending memos
        const memosToSave = [...pendingMemos];
        try {
          // Save all pending memos
          const savePromises = memosToSave.map((memoText) =>
            fetch(`/api/organization/${organizationId}/cost/${costId}/memo`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ memo: memoText }),
            })
          );

          await Promise.all(savePromises);
          // Clear pending memos after saving
          setPendingMemos([]);
          onPendingMemosChange?.([]);
          // Remove pending memos from display
          setMemos((prev) => prev.filter((m) => !m.id.startsWith('pending-')));
          // Refetch memos to show the newly saved ones
          const res = await fetch(
            `/api/organization/${organizationId}/cost/${costId}/memo`
          );
          if (res.ok) {
            const data = await res.json();
            const sortedMemos = (data.memos || []).sort(
              (a: MemoType, b: MemoType) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA;
              }
            );
            setMemos(sortedMemos);
          }
        } catch (error) {
          console.error('Failed to save pending memos:', error);
        }
      };

      savePendingMemos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costId, organizationId]);

  // Fetch memos
  useEffect(() => {
    if (!organizationId) {
      setIsLoading(false);
      setMemos([]);
      return;
    }

    if (!costId) {
      setIsLoading(false);
      setMemos([]);
      return;
    }

    // Reset loading state and clear memos when costId changes
    setIsLoading(true);
    setMemos([]);

    const fetchMemos = async () => {
      try {
        const res = await fetch(
          `/api/organization/${organizationId}/cost/${costId}/memo`
        );
        if (res.ok) {
          const data = await res.json();
          // Sort by createdAt descending (most recent first)
          const sortedMemos = (data.memos || []).sort(
            (a: MemoType, b: MemoType) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return dateB - dateA;
            }
          );
          setMemos(sortedMemos);
        }
      } catch (error) {
        console.error('Failed to fetch memos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemos();
  }, [costId, organizationId]);

  const handleAddMemo = async () => {
    if (!newMemo.trim() || isSaving || disabled) return;

    const memoText = newMemo.trim();
    setNewMemo('');

    // If costId exists, save immediately
    if (costId) {
      setIsSaving(true);
      try {
        const res = await fetch(
          `/api/organization/${organizationId}/cost/${costId}/memo`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memo: memoText }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          setMemos((prev) => [data.memo, ...prev]);
        } else {
          const error = await res.json();
          throw new Error(error.message || 'Failed to create memo');
        }
      } catch (error) {
        console.error('Failed to create memo:', error);
        // Restore memo text on error
        setNewMemo(memoText);
      } finally {
        setIsSaving(false);
      }
    } else {
      // If no costId, store as pending memo
      const newPendingMemos = [...pendingMemos, memoText];
      setPendingMemos(newPendingMemos);
      onPendingMemosChange?.(newPendingMemos);
      // Add to memos list as a temporary memo (will be saved when cost is created)
      const tempMemo: MemoType = {
        id: `pending-${Date.now()}`,
        memo: memoText,
        userId: user?.id || '',
        user: user
          ? {
              name: user.name,
              email: user.email,
            }
          : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setMemos((prev) => [tempMemo, ...prev]);
    }
  };

  const handleEditMemo = async (id: string, newMemoText: string) => {
    if (!newMemoText.trim() || disabled || !costId) return;

    // Don't allow editing pending memos
    if (id.startsWith('pending-')) {
      return;
    }

    try {
      const res = await fetch(
        `/api/organization/${organizationId}/cost/${costId}/memo/${id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memo: newMemoText }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setMemos((prev) => prev.map((m) => (m.id === id ? data.memo : m)));
      } else {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update memo');
      }
    } catch (error) {
      console.error('Failed to update memo:', error);
      throw error;
    }
  };

  const handleDeleteMemo = async (id: string) => {
    if (disabled) return;

    // If it's a pending memo, just remove it from state
    if (id.startsWith('pending-')) {
      // Find the memo to get its text
      const memoToDelete = memos.find((m) => m.id === id);
      if (memoToDelete) {
        // Remove from memos list
        setMemos((prev) => prev.filter((m) => m.id !== id));
        // Remove from pending memos array
        setPendingMemos((prev) => {
          const newPending = prev.filter(
            (memoText) => memoText !== memoToDelete.memo
          );
          onPendingMemosChange?.(newPending);
          return newPending;
        });
      }
      return;
    }

    // If costId doesn't exist, can't delete saved memos
    if (!costId) {
      return;
    }

    try {
      const res = await fetch(
        `/api/organization/${organizationId}/cost/${costId}/memo/${id}`,
        {
          method: 'DELETE',
        }
      );

      if (res.ok) {
        // Remove from memos list
        setMemos((prev) => prev.filter((m) => m.id !== id));
      } else {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete memo');
      }
    } catch (error) {
      console.error('Failed to delete memo:', error);
      throw error;
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4 flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900">{t('Cost.memo')}</h3>

      {/* Memo input */}
      <div className="space-y-2">
        <Textarea
          placeholder={t('Cost.enterMemo')}
          value={newMemo}
          onChange={(e) => setNewMemo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleAddMemo();
            }
          }}
          disabled={isSaving || disabled}
          className="bg-white"
        />
        <div className="flex justify-between items-center mb-6">
          {!costId && pendingMemos.length > 0 ? (
            <p className="text-xs text-gray-500">
              {t('Cost.pendingMemosWillBeSaved', {
                count: pendingMemos.length,
              }) ||
                `${pendingMemos.length} memo(s) will be saved when you save the cost`}
            </p>
          ) : (
            <div />
          )}
          <div className="flex justify-end">
            <Button
              onClick={handleAddMemo}
              isLoading={isSaving}
              disabled={!newMemo.trim() || disabled}
              size="sm"
            >
              {t('Cost.addMemo')}
            </Button>
          </div>
        </div>
      </div>

      {/* Memo list */}
      <div className="max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4 gap-2">
            <Spinner className="w-4 h-4" />
          </div>
        ) : memos.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            {t('Cost.noMemosYet')}
          </div>
        ) : (
          <div className="space-y-0">
            {memos.map((memo, index) => (
              <Memo
                key={memo.id}
                memo={memo}
                isLast={index === memos.length - 1}
                onEdit={handleEditMemo}
                onDelete={handleDeleteMemo}
                disabled={disabled || memo.id.startsWith('pending-')}
                allowDelete={memo.id.startsWith('pending-')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoArea;
