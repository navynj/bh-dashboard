'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { CostTag } from '../../types/cost';

interface Props {
  tags: CostTag[];
  disabled?: boolean;
  onChange: (tags: CostTag[]) => void;
}

export default function TagInput({ tags, disabled, onChange }: Props) {
  const t = useTranslations('Cost');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CostTag[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function search(q: string) {
    try {
      const url = q ? `/api/cost/tags?search=${encodeURIComponent(q)}` : '/api/cost/tags';
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions((data.tags ?? []).filter((t: CostTag) => !tags.some((tag) => tag.id === t.id)));
    } catch {/* ignore */}
  }

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tags]);

  async function handleCreateTag() {
    const name = query.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/cost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onChange([...tags, data.tag]);
      setQuery('');
      setOpen(false);
    } catch {
      toast.error(t('tagCreateFailed'));
    }
  }

  function handleSelect(tag: CostTag) {
    onChange([...tags, tag]);
    setQuery('');
    setOpen(false);
  }

  function handleRemove(id: string) {
    onChange(tags.filter((t) => t.id !== id));
  }

  const exactMatch = suggestions.some((s) => s.name.toLowerCase() === query.trim().toLowerCase());
  const showCreate = query.trim().length > 0 && !exactMatch;

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex flex-wrap gap-1.5 items-center min-h-[36px] rounded-md border bg-background px-2 py-1">
        {tags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="text-xs gap-1 pr-1"
            style={{ backgroundColor: tag.color !== 'gray' ? `var(--${tag.color}-100, #e5e7eb)` : undefined }}
          >
            {tag.name}
            {!disabled && (
              <button
                onClick={() => handleRemove(tag.id)}
                className="rounded-sm hover:bg-muted ml-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </Badge>
        ))}
        {!disabled && (
          <Input
            className="h-6 border-none shadow-none p-0 text-xs flex-1 min-w-[80px] focus-visible:ring-0"
            placeholder={t('addTag')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        )}
      </div>

      {open && !disabled && (suggestions.length > 0 || showCreate) && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md py-1 max-h-48 overflow-y-auto">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
              onClick={() => handleSelect(tag)}
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color !== 'gray' ? tag.color : '#9ca3af' }}
              />
              {tag.name}
            </button>
          ))}
          {showCreate && (
            <button
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 text-muted-foreground"
              onClick={handleCreateTag}
            >
              <Plus className="h-3 w-3" />
              {t('createTagNew')}: &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
