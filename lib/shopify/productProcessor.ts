import { createAdminApiClient } from '@shopify/admin-api-client';
import type {
  ShopifyProduct,
  ProductMetadata,
  ShopifyMetaobjectResponse,
} from '@/types/shopify';

export type ShopifyClient = ReturnType<typeof createAdminApiClient>;

export async function fetchProductMetadata(
  shopifyClient: ShopifyClient,
  metafieldId: string
): Promise<ProductMetadata> {
  try {
    const { data, errors } =
      await shopifyClient.request<ShopifyMetaobjectResponse>(
        `query ($id: ID!) {
        metaobject(id: $id) {
          fields { key value type }
        }
      }`,
        { variables: { id: metafieldId } }
      );
    if (errors) return {};
    const metadata: ProductMetadata = {};
    data?.metaobject?.fields?.forEach(({ key, value, type }) => {
      metadata[key] =
        type === 'number_integer' || type === 'number_decimal' ? +value : value;
    });
    return metadata;
  } catch {
    return {};
  }
}

export function extractImageData(
  imageNode: { altText?: string; url: string } | null | undefined
): { alt: string; src: string } | null {
  if (!imageNode?.url) return null;
  return { alt: imageNode.altText || '', src: imageNode.url };
}

export async function processShopifyProduct(
  product: {
    id: string;
    status: string;
    media?: {
      nodes: Array<{
        preview?: { image?: { altText?: string; url: string } };
      }>;
    };
    metafield?: { jsonValue?: string[] };
    [key: string]: unknown;
  },
  shopifyClient: ShopifyClient
): Promise<Omit<ShopifyProduct, 'unitPrice' | 'gPrice'>> {
  const { id, media, metafield, status, ...productData } = product;
  const processed: Omit<ShopifyProduct, 'unitPrice' | 'gPrice'> = {
    ...(productData as Omit<ShopifyProduct, 'id' | 'unitPrice' | 'gPrice'>),
    id: id?.split('/').pop() || '',
    tracksInventory: false,
    active: status === 'ACTIVE',
  } as Omit<ShopifyProduct, 'unitPrice' | 'gPrice'>;

  const metafieldId = metafield?.jsonValue?.[0];
  if (metafieldId) {
    processed.metadata = await fetchProductMetadata(shopifyClient, metafieldId);
  }

  if (media?.nodes?.[0]?.preview?.image) {
    const firstImage = extractImageData(media.nodes[0].preview.image);
    if (firstImage) {
      processed.thumbnail = firstImage;
      processed.thumbnails = [firstImage];
    }
  }
  return processed;
}
