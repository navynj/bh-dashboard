/**
 * Admin GraphQL product search for office “add line” flows. Requires `read_products`.
 */

import { createAdminApiClient } from '@shopify/admin-api-client';
import { shopifyMoneyAmountToDecimalString } from '@/lib/shopify/graphql-money';
import { getShopifyAdminEnv } from '@/lib/shopify/env';
import type { ShopifyAdminCredentials } from '@/types/shopify';

const PRODUCTS_SEARCH = `query OfficeProductsSearch($first: Int!, $query: String!) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        handle
        featuredImage {
          url
        }
        variants(first: 50) {
          edges {
            node {
              id
              title
              sku
              price
              image {
                url
              }
              inventoryItem {
                unitCost {
                  amount
                }
              }
            }
          }
        }
      }
    }
  }
}`;

export type OfficeProductSearchVariantHit = {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string | null;
  sku: string | null;
  price: string | null;
  /** Variant inventory unit cost (Shopify), when present. */
  unitCost: string | null;
  /** Variant image, else product featured image. */
  imageUrl: string | null;
};

export type OfficeProductSearchData = {
  products: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        handle: string;
        featuredImage?: { url: string | null } | null;
        variants: {
          edges: Array<{
            node: {
              id: string;
              title: string | null;
              sku: string | null;
              price?: unknown;
              image?: { url: string | null } | null;
              inventoryItem?: {
                unitCost?: { amount: string } | null;
              } | null;
            };
          }>;
        };
      };
    }>;
  };
};

export async function searchProductsForOffice(
  creds: ShopifyAdminCredentials,
  query: string,
  first = 15,
): Promise<OfficeProductSearchVariantHit[]> {
  const client = createAdminApiClient({
    storeDomain: creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });

  const { data, errors } = await client.request<OfficeProductSearchData>(PRODUCTS_SEARCH, {
    variables: { first, query },
  });
  const errList = Array.isArray(errors) ? errors : errors ? [errors] : [];
  if (errList.length > 0) {
    const msg = errList
      .map((e) =>
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e),
      )
      .join('; ');
    throw new Error(`Shopify products search failed: ${msg}`);
  }

  const hits: OfficeProductSearchVariantHit[] = [];
  for (const edge of data?.products?.edges ?? []) {
    const p = edge.node;
    for (const ve of p.variants.edges) {
      const v = ve.node;
      const imageUrl =
        v.image?.url?.trim() ||
        p.featuredImage?.url?.trim() ||
        null;
      hits.push({
        productId: p.id,
        productTitle: p.title,
        variantId: v.id,
        variantTitle: v.title,
        sku: v.sku,
        price: shopifyMoneyAmountToDecimalString(v.price),
        unitCost: v.inventoryItem?.unitCost?.amount?.trim()
          ? v.inventoryItem.unitCost.amount
          : null,
        imageUrl,
      });
    }
  }
  return hits;
}

export function searchProductsForOfficeFromEnv(query: string, first?: number) {
  return searchProductsForOffice(getShopifyAdminEnv(), query, first);
}
