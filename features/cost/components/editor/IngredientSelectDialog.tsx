'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IngredientEditorItem } from '../../types/cost';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedProduct {
  variantId: string;
  productId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number | null;
  gPrice: number | null;
  unit: string;
  gPerPc: number | null;
  metadata: Record<string, unknown> | null;
}

interface CostSearchItem {
  id: string;
  title: string;
  totalCount: number;
  pricePerProduct: number | null;
  prices: { price: number; isFinalPrice: boolean }[];
}

type SortDir = 'asc' | 'desc' | null;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (patch: Partial<IngredientEditorItem>) => void;
  isPackaging?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IngredientSelectDialog({ open, onClose, onSelect, isPackaging }: Props) {
  const t = useTranslations('Cost');
  const [tab, setTab] = useState<'products' | 'costs'>('products');

  function handleClose() {
    onClose();
  }

  const tabCls = (v: 'products' | 'costs') =>
    `flex-1 py-2 text-sm font-semibold transition-colors border-b-2 ${
      tab === v ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
          <DialogTitle>{isPackaging ? t('selectPackaging') : t('selectIngredient')}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b px-6 shrink-0">
          <button className={tabCls('products')} onClick={() => setTab('products')}>
            {t('selectProducts')}
          </button>
          {!isPackaging && (
            <button className={tabCls('costs')} onClick={() => setTab('costs')}>
              {t('selectCosts')}
            </button>
          )}
        </div>

        {/* flex-1 + min-h-0 lets the child shrink below content height */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === 'products' ? (
            <ProductsTab onSelect={onSelect} onClose={handleClose} />
          ) : (
            <CostsTab onSelect={onSelect} onClose={handleClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab({
  onSelect,
  onClose,
}: {
  onSelect: (patch: Partial<IngredientEditorItem>) => void;
  onClose: () => void;
}) {
  const t = useTranslations('Cost');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gPriceSort, setGPriceSort] = useState<SortDir>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (q: string, cursor: string | null, replace: boolean) => {
    if (q.length < 2) {
      if (replace) setProducts([]);
      return;
    }
    replace ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/cost/ingredient-search?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Search failed');
      const data = await res.json();
      setProducts((prev) => replace ? data.products ?? [] : [...prev, ...(data.products ?? [])]);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      replace ? setLoading(false) : setLoadingMore(false);
    }
  }, []);

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setGPriceSort(null);
    debounceRef.current = setTimeout(() => fetchPage(query, null, true), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchPage]);

  // Infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchPage(query, nextCursor, false);
        }
      },
      { root: listRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, query, nextCursor, fetchPage]);

  // Sort displayed list by gPrice
  const sorted = gPriceSort
    ? [...products].sort((a, b) => {
        const ag = a.gPrice ?? Infinity;
        const bg = b.gPrice ?? Infinity;
        return gPriceSort === 'asc' ? ag - bg : bg - ag;
      })
    : products;

  function cycleSort() {
    setGPriceSort((s) => (s === null ? 'asc' : s === 'asc' ? 'desc' : null));
  }

  function handleSelect(p: EnrichedProduct) {
    onSelect({
      title: [p.title, p.variantTitle].filter(Boolean).join(' - '),
      variantId: p.variantId,
      unit: p.unit ?? 'g',
      amount: 0,
      unitPrice: p.unitPrice,
      amountPrice: null,
      gPrice: p.gPrice,
      image: p.imageUrl ? { src: p.imageUrl, alt: p.title } : null,
      type: 'product',
    });
    onClose();
  }

  const SortIcon = gPriceSort === 'asc' ? ArrowUp : gPriceSort === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="px-6 py-3 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-8 h-8 text-sm"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table header */}
      {(products.length > 0 || loading) && (
        <div className="grid grid-cols-[40px_1fr_100px_100px_40px] items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/40 shrink-0">
          <span />
          <span>{t('ingredientName')}</span>
          <span className="text-right">{t('unitPrice')}</span>
          <button
            className="flex items-center justify-end gap-1 hover:text-foreground transition-colors"
            onClick={cycleSort}
          >
            100g
            <SortIcon className="h-3 w-3" />
          </button>
          <span />
        </div>
      )}

      {/* Scrollable list — min-h-0 prevents flex item from expanding beyond parent */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto">
        {error && <p className="text-xs text-destructive px-6 py-3">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {query.length < 2 ? t('typeToSearch') : t('noResults')}
          </p>
        ) : (
          <>
            {sorted.map((p) => (
              <button
                key={p.variantId}
                className="w-full grid grid-cols-[40px_1fr_100px_100px_40px] items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors border-b border-border/50"
                onClick={() => handleSelect(p)}
              >
                {/* Image */}
                {p.imageUrl ? (
                  <div className="relative h-8 w-8 rounded overflow-hidden border">
                    <Image src={p.imageUrl} alt={p.title} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded border bg-muted" />
                )}

                {/* Title */}
                <div className="min-w-0">
                  <p className="font-medium truncate leading-tight">{p.title}</p>
                  {p.variantTitle && (
                    <p className="text-xs text-muted-foreground truncate">{p.variantTitle}</p>
                  )}
                </div>

                {/* unitPrice */}
                <p className="text-right tabular-nums text-xs">
                  {p.unitPrice != null ? `$${p.unitPrice.toFixed(2)}/${p.unit}` : '—'}
                </p>

                {/* gPrice */}
                <p className={`text-right tabular-nums text-xs font-medium ${p.gPrice == null ? 'text-destructive' : ''}`}>
                  {p.gPrice != null ? `$${p.gPrice.toFixed(4)}` : t('gPerPcRequired')}
                </p>

                <ChevronRight className="h-4 w-4 text-muted-foreground justify-self-end" />
              </button>
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="py-1">
              {loadingMore && (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Costs Tab ────────────────────────────────────────────────────────────────

function CostsTab({
  onSelect,
  onClose,
}: {
  onSelect: (patch: Partial<IngredientEditorItem>) => void;
  onClose: () => void;
}) {
  const t = useTranslations('Cost');
  const [query, setQuery] = useState('');
  const [costs, setCosts] = useState<CostSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = q.length >= 2 ? `/api/cost?search=${encodeURIComponent(q)}` : '/api/cost';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setCosts(
        (data.costs ?? []).map((c: { id: string; title: string; totalCount: number; prices: { price: number; isFinalPrice: boolean }[] }) => ({
          id: c.id,
          title: c.title,
          totalCount: c.totalCount,
          prices: c.prices ?? [],
          pricePerProduct:
            c.prices?.find((p: { isFinalPrice: boolean }) => p.isFinalPrice)?.price ??
            c.prices?.[0]?.price ??
            null,
        })),
      );
    } catch {
      setError('Failed to load costs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + debounced search
  useEffect(() => { search(''); }, [search]);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  async function handleSelect(costId: string) {
    setSelectingId(costId);
    try {
      const res = await fetch(`/api/cost/${costId}`);
      if (!res.ok) throw new Error('Failed to fetch cost');
      const data = await res.json();
      const cost = data.cost;
      const totalIngredientWeight = (cost.ingredients ?? []).reduce(
        (s: number, i: { amount: number }) => s + i.amount, 0,
      );
      const finalWeight = cost.finalWeight ?? totalIngredientWeight / Math.max(cost.totalCount, 1);
      const unitCost: number =
        cost.prices?.find((p: { isFinalPrice: boolean }) => p.isFinalPrice)?.price ??
        cost.prices?.[0]?.price ?? 0;
      onSelect({
        title: cost.title,
        variantId: '',
        unit: 'g',
        amount: finalWeight,
        unitPrice: unitCost,
        amountPrice: unitCost,
        gPrice: finalWeight > 0 ? unitCost / finalWeight : null,
        image: null,
        type: 'cost',
      });
      onClose();
    } catch {
      setError('Failed to load cost details');
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-3 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-8 h-8 text-sm"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {error && <p className="text-xs text-destructive px-6 py-3">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : costs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t('noResults')}</p>
        ) : (
          costs.map((c) => (
            <button
              key={c.id}
              className="w-full flex items-center justify-between px-6 py-3 text-left text-sm hover:bg-muted/60 transition-colors border-b border-border/50 disabled:opacity-50"
              onClick={() => handleSelect(c.id)}
              disabled={selectingId !== null}
            >
              <span className="font-medium">{c.title}</span>
              <div className="flex items-center gap-4 shrink-0 ml-4">
                <span className="text-xs text-muted-foreground">×{c.totalCount}</span>
                {c.pricePerProduct != null && (
                  <span className="tabular-nums text-xs font-medium">${c.pricePerProduct.toFixed(2)}</span>
                )}
                {selectingId === c.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
