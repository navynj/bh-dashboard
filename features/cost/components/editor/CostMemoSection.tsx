'use client';

import { useState, useEffect, type MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { CostMemoApiItem } from '../../types/cost';

interface Props {
  costId: string | undefined;
  pendingMemosRef: MutableRefObject<string[]>;
}

export default function CostMemoSection({ costId, pendingMemosRef }: Props) {
  const t = useTranslations('Cost');
  const [memos, setMemos] = useState<CostMemoApiItem[]>([]);
  const [newMemo, setNewMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!costId) return;
    setLoading(true);
    fetch(`/api/cost/${costId}/memo`)
      .then((r) => r.json())
      .then((d) => setMemos(d.memos ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [costId]);

  async function handleSubmit() {
    const text = newMemo.trim();
    if (!text) return;

    if (!costId) {
      // Buffer for after first save
      pendingMemosRef.current = [...pendingMemosRef.current, text];
      setNewMemo('');
      toast.info(t('memoWillSaveAfterCost'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/cost/${costId}/memo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: text }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMemos((prev) => [...prev, data.memo]);
      setNewMemo('');
    } catch {
      toast.error(t('memoSaveFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(memoId: string) {
    if (!costId) return;
    try {
      const res = await fetch(`/api/cost/${costId}/memo/${memoId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setMemos((prev) => prev.filter((m) => m.id !== memoId));
    } catch {
      toast.error(t('memoDeleteFailed'));
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">{t('memos')}</h3>

      {/* Input area */}
      <div className="flex gap-2">
        <Textarea
          className="text-sm resize-none min-h-[64px]"
          placeholder={t('memoPlaceholder')}
          value={newMemo}
          onChange={(e) => setNewMemo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 self-end"
          onClick={handleSubmit}
          disabled={submitting || !newMemo.trim()}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* Memo list */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : memos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t('noMemos')}</p>
      ) : (
        <div className="space-y-2">
          {memos.map((memo) => (
            <div key={memo.id} className="rounded-md border p-3 text-sm group relative">
              <p className="whitespace-pre-wrap pr-7">{memo.memo}</p>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{memo.user?.name ?? memo.user?.email ?? t('unknownUser')}</span>
                <span>{new Date(memo.createdAt).toLocaleDateString()}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                onClick={() => handleDelete(memo.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
