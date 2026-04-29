'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ShopifyProductSearchHit } from '@/components/shopify/types';
import {
  ShopifyProductSearchPanel,
  type ShopifyProductSearchPanelProps,
} from '@/components/shopify/ShopifyProductSearchPanel';

export type ShopifyProductSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (hit: ShopifyProductSearchHit) => void;
  title?: string;
} & Pick<
  ShopifyProductSearchPanelProps,
  'searchPath' | 'minQueryLength' | 'debounceMs' | 'searchPlaceholder'
>;

/**
 * Reusable Shopify catalog variant picker (Admin product search).
 * Embed {@link ShopifyProductSearchPanel} instead when you already have a host `Dialog`.
 */
export function ShopifyProductSearchDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Search Shopify products',
  searchPath,
  minQueryLength,
  debounceMs,
  searchPlaceholder,
}: ShopifyProductSearchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <ShopifyProductSearchPanel
          searchPath={searchPath}
          minQueryLength={minQueryLength}
          debounceMs={debounceMs}
          searchPlaceholder={searchPlaceholder}
          onSelect={(hit) => {
            onSelect(hit);
            onOpenChange(false);
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
