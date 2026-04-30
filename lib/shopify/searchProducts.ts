/**
 * Admin GraphQL product search for office “add line” flows. Requires `read_products`.
 */

import { createAdminApiClient } from '@shopify/admin-api-client';
import { shopifyMoneyAmountToDecimalString } from '@/lib/shopify/graphql-money';
import { getShopifyAdminEnv } from '@/lib/shopify/env';
import type { ShopifyAdminCredentials } from '@/types/shopify';

const PRODUCTS_COUNT = `query OfficeSearchProductsCount($query: String!) {
  productsCount(query: $query) {
    count
  }
}`;

const PRODUCTS_SEARCH = `query OfficeProductsSearch($first: Int!, $query: String!) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        status
        handle
        featuredImage {
          url
        }
        variants(first: 25) {
          edges {
            node {
              id
              title
              sku
              price
              image {
                url
              }
            }
          }
        }
      }
    }
  }
}`;

export type OfficeProductSearchProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export type OfficeProductSearchVariantHit = {
  productId: string;
  productTitle: string;
  productStatus: OfficeProductSearchProductStatus;
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
        status: string;
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
            };
          }>;
        };
      };
    }>;
  };
};

type OfficeProductsCountData = {
  productsCount?: { count?: number | null } | null;
};

function normalizeProductStatus(raw: string | undefined | null): OfficeProductSearchProductStatus {
  const s = (raw ?? '').trim().toUpperCase();
  if (s === 'DRAFT' || s === 'ACTIVE' || s === 'ARCHIVED') return s;
  return 'ACTIVE';
}

function shopifySearchQueryWithStatusScope(
  userQuery: string,
  includeDrafts: boolean,
): string {
  const q = userQuery.trim();
  const statusPart = includeDrafts ? '(status:active OR status:draft)' : 'status:active';
  if (!q) return statusPart;
  return `${q} AND ${statusPart}`;
}

function shopifyDraftCountQueryForSearch(userQuery: string): string {
  const q = userQuery.trim();
  return q ? `${q} AND status:draft` : 'status:draft';
}

export async function fetchDraftProductCountForOfficeSearch(
  creds: ShopifyAdminCredentials,
  userQuery: string,
): Promise<number> {
  const client = createAdminApiClient({
    storeDomain: creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });
  const query = shopifyDraftCountQueryForSearch(userQuery);
  const { data, errors } = await client.request<OfficeProductsCountData>(PRODUCTS_COUNT, {
    variables: { query },
  });
  const errList = Array.isArray(errors) ? errors : errors ? [errors] : [];
  if (errList.length > 0) {
    const msg = errList
      .map((e) =>
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e),
      )
      .join('; ');
    throw new Error(`Shopify productsCount failed: ${msg}`);
  }
  const n = data?.productsCount?.count;
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
}

export async function searchProductsForOffice(
  creds: ShopifyAdminCredentials,
  query: string,
  first = 15,
  opts?: { includeDrafts?: boolean },
): Promise<OfficeProductSearchVariantHit[]> {
  const client = createAdminApiClient({
    storeDomain: creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });

  const scopedQuery = shopifySearchQueryWithStatusScope(query, Boolean(opts?.includeDrafts));

  const { data, errors } = await client.request<OfficeProductSearchData>(PRODUCTS_SEARCH, {
    variables: { first, query: scopedQuery },
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
    const productStatus = normalizeProductStatus(p.status);
    for (const ve of p.variants.edges) {
      const v = ve.node;
      const imageUrl =
        v.image?.url?.trim() ||
        p.featuredImage?.url?.trim() ||
        null;
      hits.push({
        productId: p.id,
        productTitle: p.title,
        productStatus,
        variantId: v.id,
        variantTitle: v.title,
        sku: v.sku,
        price: shopifyMoneyAmountToDecimalString(v.price),
        unitCost: null,
        imageUrl,
      });
    }
  }
  return hits;
}

export function searchProductsForOfficeFromEnv(
  query: string,
  first?: number,
  opts?: { includeDrafts?: boolean },
) {
  return searchProductsForOffice(getShopifyAdminEnv(), query, first, opts);
}
