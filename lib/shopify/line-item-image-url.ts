import type {
  ShopifyOrderLineNode,
  ShopifyOrderLineProductImages,
} from '@/types/shopify';

type GqlImage = { url?: string | null } | null | undefined;

function trimUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const t = url.trim();
  return t.length > 0 ? t : null;
}

function fromGqlImage(img: GqlImage): string | null {
  return trimUrl(img?.url);
}

type MediaImageishNode = {
  image?: GqlImage;
  preview?: { image?: GqlImage } | null;
};

function fromMediaImageNode(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const n = node as MediaImageishNode;
  return fromGqlImage(n.image) ?? fromGqlImage(n.preview?.image ?? null);
}

function firstImageFromMediaConnection(
  conn: ShopifyOrderLineProductImages['media'],
): string | null {
  for (const edge of conn?.edges ?? []) {
    const u = fromMediaImageNode(edge?.node);
    if (u) return u;
  }
  return null;
}

function imageUrlFromProductSnapshot(p: ShopifyOrderLineProductImages | null | undefined): string | null {
  if (!p) return null;
  return (
    fromGqlImage(p.featuredImage) ??
    fromMediaImageNode(p.featuredMedia) ??
    firstImageFromMediaConnection(p.media)
  );
}

/** Best-effort image URL from a synced order line (snapshot, variant media, product media). */
export function lineItemImageUrlFromShopifyNode(
  li: Pick<ShopifyOrderLineNode, 'image' | 'variant' | 'product'>,
): string | null {
  const fromLine = fromGqlImage(li.image);
  if (fromLine) return fromLine;

  const v = li.variant;
  if (v) {
    const fromVariantLegacy = fromGqlImage(v.image);
    if (fromVariantLegacy) return fromVariantLegacy;
    const fromVariantMedia = firstImageFromMediaConnection(v.media);
    if (fromVariantMedia) return fromVariantMedia;
    const fromVariantProduct = imageUrlFromProductSnapshot(v.product);
    if (fromVariantProduct) return fromVariantProduct;
  }

  return imageUrlFromProductSnapshot(li.product);
}
