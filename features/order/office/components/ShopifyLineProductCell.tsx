'use client';

import { useMemo, type ReactNode } from 'react';
import { LineItemThumb } from './LineItemThumb';
import { cn } from '@/lib/utils/cn';
import { buildShopifyAdminProductVariantEditUrl } from '@/lib/shopify/admin-product-variant-edit-url';

type Props = {
  /** When `'none'`, product cell is not wrapped in an admin link (use a separate control, e.g. arrow column). */
  linkMode?: 'cell' | 'none';
  shopifyAdminStoreHandle?: string | null;
  shopifyProductGid?: string | null;
  shopifyVariantGid?: string | null;
  imageUrl?: string | null;
  label: string;
  sku?: string | null;
  afterTitle?: ReactNode;
  className?: string;
};

export function ShopifyLineProductCell({
  linkMode = 'cell',
  shopifyAdminStoreHandle,
  shopifyProductGid,
  shopifyVariantGid,
  imageUrl,
  label,
  sku,
  afterTitle,
  className,
}: Props) {
  const href = useMemo(() => {
    if (linkMode !== 'cell') return null;
    const handle = shopifyAdminStoreHandle?.trim();
    if (!handle) return null;
    return buildShopifyAdminProductVariantEditUrl({
      storeHandle: handle,
      productGid: shopifyProductGid,
      variantGid: shopifyVariantGid,
    });
  }, [
    linkMode,
    shopifyAdminStoreHandle,
    shopifyProductGid,
    shopifyVariantGid,
  ]);

  const body = (
    <>
      <LineItemThumb imageUrl={imageUrl} label={label} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] leading-tight">
          {label}
          {afterTitle}
        </div>
        <div className="text-[9px] font-mono text-muted-foreground">
          {sku?.trim() ? sku : '—'}
        </div>
      </div>
    </>
  );

  if (!href) {
    return (
      <div
        className={cn('flex gap-2 min-w-0', className)}
        title={
          !shopifyAdminStoreHandle?.trim()
            ? 'Set SHOPIFY_SHOP_DOMAIN (myshopify) or SHOPIFY_ADMIN_STORE_HANDLE for Admin links'
            : !shopifyProductGid?.trim()
              ? 'Product Admin link needs a synced Shopify product id — run order sync after DB migration'
              : undefined
        }
      >
        {body}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Shopify Admin (new tab)"
      className={cn(
        'relative z-10 flex min-w-0 w-full cursor-pointer gap-2 rounded-sm text-inherit no-underline hover:bg-muted/45 outline-none focus-visible:ring-2 focus-visible:ring-ring -mx-0.5 px-0.5 -my-0.5 py-0.5',
        className,
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onAuxClick={(e) => e.stopPropagation()}
    >
      {body}
    </a>
  );
}
