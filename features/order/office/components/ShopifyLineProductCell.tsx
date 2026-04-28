'use client';

import type { ReactNode } from 'react';
import { LineItemThumb } from './LineItemThumb';
import { cn } from '@/lib/utils/cn';
import { buildShopifyAdminProductVariantEditUrl } from '@/lib/shopify/admin-product-variant-edit-url';

type Props = {
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
  shopifyAdminStoreHandle,
  shopifyProductGid,
  shopifyVariantGid,
  imageUrl,
  label,
  sku,
  afterTitle,
  className,
}: Props) {
  const href =
    shopifyAdminStoreHandle &&
    buildShopifyAdminProductVariantEditUrl({
      storeHandle: shopifyAdminStoreHandle,
      productGid: shopifyProductGid,
      variantGid: shopifyVariantGid,
    });

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
    return <div className={cn('flex gap-2 min-w-0', className)}>{body}</div>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open product in Shopify Admin (new tab)"
      className={cn(
        'flex gap-2 min-w-0 rounded-sm text-inherit no-underline hover:bg-muted/45 outline-none focus-visible:ring-2 focus-visible:ring-ring -mx-0.5 px-0.5 -my-0.5 py-0.5',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </a>
  );
}
