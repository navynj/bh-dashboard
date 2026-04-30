'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { ShopifyProductSearchHit } from '@/components/shopify/types';
import { DEFAULT_SHOPIFY_PRODUCT_SEARCH_PATH } from '@/components/shopify/shopify-product-search-constants';

function SearchHitThumb({
  imageUrl,
  label,
  className,
}: {
  imageUrl: string | null | undefined;
  label: string;
  className?: string;
}) {
  const url = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  return (
    <div
      className={cn(
        'h-9 w-9 flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/30 flex items-center justify-center',
        className,
      )}
      aria-hidden={!url}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Shopify CDN URLs
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

export type ShopifyProductSearchPanelProps = {
  /** Called when the user picks a catalog variant (single click). */
  onSelect: (hit: ShopifyProductSearchHit) => void;
  /**
   * Path for `GET ?q=` (must return `{ ok?: boolean; hits?: ShopifyProductSearchHit[]; error?: string }`).
   * @default {@link DEFAULT_SHOPIFY_PRODUCT_SEARCH_PATH}
   */
  searchPath?: string;
  minQueryLength?: number;
  debounceMs?: number;
  /** Placeholder on the search input. */
  searchPlaceholder?: string;
  className?: string;
  /** Max height of the results list. */
  resultsMaxHeightClassName?: string;
};

export function ShopifyProductSearchPanel({
  onSelect,
  searchPath = DEFAULT_SHOPIFY_PRODUCT_SEARCH_PATH,
  minQueryLength = 2,
  debounceMs = 280,
  searchPlaceholder = 'Search products…',
  className,
  resultsMaxHeightClassName = 'max-h-56',
}: ShopifyProductSearchPanelProps) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [hits, setHits] = useState<ShopifyProductSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const searchSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]);

  const runSearch = useCallback(async () => {
    const query = debouncedQ.trim();
    if (query.length < minQueryLength) {
      abortRef.current?.abort();
      abortRef.current = null;
      searchSeqRef.current += 1;
      setHits([]);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const seq = ++searchSeqRef.current;
    setLoading(true);
    try {
      const url = `${searchPath}?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { signal: ac.signal });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        hits?: ShopifyProductSearchHit[];
        error?: string;
      };
      if (seq !== searchSeqRef.current) return;
      if (!res.ok) {
        toast.error(
          typeof data?.error === 'string' ? data.error : 'Product search failed',
        );
        setHits([]);
        return;
      }
      setHits(Array.isArray(data.hits) ? data.hits : []);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (seq !== searchSeqRef.current) return;
      toast.error('Product search failed');
      setHits([]);
    } finally {
      if (seq === searchSeqRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedQ, minQueryLength, searchPath]);

  useEffect(() => {
    void runSearch();
    return () => {
      abortRef.current?.abort();
    };
  }, [runSearch]);

  const manualSearch = useCallback(() => {
    void runSearch();
  }, [runSearch]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') manualSearch();
          }}
        />
        <Button type="button" size="sm" variant="secondary" onClick={manualSearch}>
          {loading ? '…' : 'Search'}
        </Button>
      </div>
      <div
        className={cn(
          'overflow-y-auto divide-y rounded-md border',
          resultsMaxHeightClassName,
        )}
      >
        {hits.length === 0 ? (
          <div className="p-3 text-[12px] text-muted-foreground">
            {debouncedQ.length < minQueryLength
              ? `Enter at least ${minQueryLength} characters.`
              : loading
                ? 'Searching…'
                : 'No results'}
          </div>
        ) : (
          hits.map((h) => (
            <button
              key={h.variantId}
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-[12px] hover:bg-muted/50"
              onClick={() => onSelect(h)}
            >
              <SearchHitThumb imageUrl={h.imageUrl} label={h.productTitle} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{h.productTitle}</div>
                <div className="text-[11px] text-muted-foreground">
                  {(h.variantTitle ?? 'Default') +
                    (h.sku ? ` · ${h.sku}` : '') +
                    (h.price ? ` · $${h.price}` : '')}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
