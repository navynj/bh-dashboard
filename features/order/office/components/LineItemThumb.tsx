'use client';

import { cn } from '@/lib/utils/cn';

type Props = {
  imageUrl: string | null | undefined;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
};

/** Small product image for order / PO line tables (Shopify CDN URLs). */
export function LineItemThumb({ imageUrl, label, className, size = 'sm' }: Props) {
  const dim = size === 'md' ? 'h-11 w-11' : 'h-9 w-9';
  const url = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  return (
    <div
      className={cn(
        dim,
        'flex-shrink-0 rounded-md border border-border/60 bg-muted/30 overflow-hidden flex items-center justify-center',
        className,
      )}
      aria-hidden={!url}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Shopify URLs; avoid next.config remotePatterns churn
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}
