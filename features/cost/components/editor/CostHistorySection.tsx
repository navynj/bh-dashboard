'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Edit, Lock, Unlock, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ItemChange {
  type: 'added' | 'deleted' | 'modified';
  itemType: string;
  item: { title: string; id: string };
  changes?: Record<string, { from: unknown; to: unknown }>;
}

interface HistoryLog {
  action: 'created' | 'updated' | 'locked' | 'unlocked';
  changes?: Record<string, unknown>;
  timestamp?: string;
}

interface HistoryItem {
  id: string;
  log: HistoryLog;
  createdAt: string;
  user: { name: string | null; email: string | null } | null;
}

const PAGE_SIZE = 10;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ActionIcon({ action }: { action: string }) {
  const cls = 'h-3.5 w-3.5';
  switch (action) {
    case 'created':  return <Plus className={`${cls} text-green-600`} />;
    case 'updated':  return <Edit className={`${cls} text-blue-500`} />;
    case 'locked':   return <Lock className={`${cls} text-yellow-600`} />;
    case 'unlocked': return <Unlock className={`${cls} text-orange-500`} />;
    default:         return <Clock className={`${cls} text-muted-foreground`} />;
  }
}

function getUserInitials(user: { name: string | null; email: string | null }): string {
  if (user.name) return user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  if (user.email) return user.email[0].toUpperCase();
  return '?';
}

function FieldChange({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
    const { from, to } = value as { from: unknown; to: unknown };
    return (
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{fieldKey}:</span>{' '}
        <span className="line-through text-destructive/70">{from == null ? '—' : String(from)}</span>
        {' → '}
        <span className="text-green-600">{to == null ? '—' : String(to)}</span>
      </div>
    );
  }
  return null;
}

function ItemChangeRow({ change }: { change: ItemChange }) {
  if (change.type === 'added') {
    return (
      <div className="text-xs flex items-center gap-1">
        <span className="text-green-600 font-bold">+</span>
        <span>{change.item.title}</span>
      </div>
    );
  }
  if (change.type === 'deleted') {
    return (
      <div className="text-xs flex items-center gap-1">
        <span className="text-destructive font-bold">−</span>
        <span className="line-through text-muted-foreground">{change.item.title}</span>
      </div>
    );
  }
  // modified
  return (
    <div className="text-xs">
      <span className="font-medium">{change.item.title}:</span>
      {Object.entries(change.changes ?? {}).map(([field, fc]) => {
        const fieldChange = fc as { from?: unknown; to?: unknown };
        return (
          <span key={field} className="ml-1">
            <span className="line-through text-destructive/70">
              {fieldChange.from == null ? '—' : String(fieldChange.from)}
            </span>
            {' → '}
            <span className="text-green-600">
              {fieldChange.to == null ? '—' : String(fieldChange.to)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function ChangesBlock({ changes, action }: { changes: Record<string, unknown> | undefined; action: string }) {
  if (!changes || Object.keys(changes).length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-muted">
      {Object.entries(changes).map(([key, value]) => {
        // Array = item-level changes (ingredients, packaging, etc.)
        if (Array.isArray(value)) {
          return (
            <div key={key} className="text-xs">
              <span className="font-medium text-muted-foreground capitalize">{key}:</span>
              <div className="ml-2 mt-0.5 space-y-0.5">
                {(value as ItemChange[]).map((c, i) => (
                  <ItemChangeRow key={i} change={c} />
                ))}
              </div>
            </div>
          );
        }
        // Regular field change {from, to}
        if (action === 'created') {
          return (
            <div key={key} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{key}:</span>{' '}
              <span>{String(value)}</span>
            </div>
          );
        }
        return <FieldChange key={key} fieldKey={key} value={value} />;
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CostHistorySection({ costId }: { costId: string }) {
  const t = useTranslations('Cost');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  async function load(currentOffset: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/cost/${costId}/history?limit=${PAGE_SIZE}&offset=${currentOffset}`);
      if (!res.ok) return;
      const data = await res.json();
      const fetched: HistoryItem[] = data.entries ?? [];
      setItems((prev) => (currentOffset === 0 ? fetched : [...prev, ...fetched]));
      setHasMore(data.hasMore ?? false);
      setOffset(currentOffset + fetched.length);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costId]);

  const actionLabel = (action: string) => {
    switch (action) {
      case 'created':  return t('historyCreated');
      case 'updated':  return t('historyUpdated');
      case 'locked':   return t('historyLocked');
      case 'unlocked': return t('historyUnlocked');
      default: return action;
    }
  };

  if (items.length === 0 && !loading) return (
    <div>
      <h3 className="font-semibold text-sm mb-3">{t('editHistory')}</h3>
      <p className="text-xs text-muted-foreground">{t('noHistory')}</p>
    </div>
  );

  return (
    <div>
      <h3 className="font-semibold text-sm mb-3">{t('editHistory')}</h3>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="relative">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1 && !hasMore;
            const user = item.user;
            const initials = user ? getUserInitials(user) : '?';
            const displayName = user?.name ?? user?.email ?? t('unknownUser');

            return (
              <div key={item.id} className="relative flex gap-3 pb-4">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                )}

                {/* Action icon bubble */}
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm">
                  <ActionIcon action={item.log.action} />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs">
                      {/* User avatar */}
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium shrink-0">
                        {initials}
                      </span>
                      <span className="font-medium text-foreground">{displayName}</span>
                      <span className="text-muted-foreground">{actionLabel(item.log.action)}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <ChangesBlock changes={item.log.changes} action={item.log.action} />
                </div>
              </div>
            );
          })}

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs mt-1"
              disabled={loading}
              onClick={() => load(offset)}
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {t('loadMore')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
