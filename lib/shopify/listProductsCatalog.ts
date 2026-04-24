/**
 * Paginated Shopify Admin catalog for office Item Settings (read_products).
 */

import { createAdminApiClient } from '@shopify/admin-api-client';
import type { ShopifyAdminCredentials } from '@/types/shopify';

const PRODUCTS_CATALOG = `query OfficeProductsCatalog($first: Int!, $after: String, $query: String!, $sortKey: ProductSortKeys!) {
  products(first: $first, after: $after, query: $query, sortKey: $sortKey) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
        vendor
        featuredImage {
          url
        }
        variants(first: 100) {
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

export type OfficeCatalogVariantRow = {
  productId: string;
  productTitle: string;
  vendor: string | null;
  variantId: string;
  variantTitle: string | null;
  sku: string | null;
  price: string | null;
  imageUrl: string | null;
};

export type OfficeProductsCatalogData = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{
      node: {
        id: string;
        title: string;
        vendor?: string | null;
        featuredImage?: { url: string | null } | null;
        variants: {
          edges: Array<{
            node: {
              id: string;
              title: string | null;
              sku: string | null;
              price: string | null;
              image?: { url: string | null } | null;
            };
          }>;
        };
      };
    }>;
  };
};

/** Shopify Admin products search `vendor:"…"` filter. */
export function shopifyProductsVendorQuery(vendorName: string): string {
  const v = vendorName.trim();
  if (!v) return '';
  const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `vendor:"${escaped}"`;
}

function escapeShopifyQueryToken(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
}

/**
 * Builds the Admin `products(query: …)` string for catalog browse + filters.
 * @see https://shopify.dev/docs/api/usage/search-syntax
 */
export function buildShopifyCatalogQuery(args: {
  vendorFilter?: string | null;
  /** Product title contains / matches (Admin product index search). */
  titleSearch?: string | null;
}): string {
  const parts: string[] = [];
  const v = args.vendorFilter?.trim();
  if (v) {
    parts.push(shopifyProductsVendorQuery(v));
  }
  const t = args.titleSearch?.trim();
  if (t) {
    const e = escapeShopifyQueryToken(t);
    // Multi-word → phrase on `title`; single token → `title:token`
    parts.push(e.includes(' ') ? `title:"${e}"` : `title:${e}`);
  }
  return parts.join(' AND ');
}

export type FetchProductsCatalogPageArgs = {
  first?: number;
  after?: string | null;
  /** When set, scopes the Admin API `products(query: …)` to this vendor. */
  vendorFilter?: string | null;
  /** Filter by product title (same query language as Shopify admin product search). */
  titleSearch?: string | null;
};

export type FetchProductsCatalogPageResult = {
  rows: OfficeCatalogVariantRow[];
  endCursor: string | null;
  hasNextPage: boolean;
};

export async function fetchProductsCatalogPage(
  creds: ShopifyAdminCredentials,
  args: FetchProductsCatalogPageArgs,
): Promise<FetchProductsCatalogPageResult> {
  const first = args.first ?? 25;
  const client = createAdminApiClient({
    storeDomain: creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });

  const query = buildShopifyCatalogQuery({
    vendorFilter: args.vendorFilter,
    titleSearch: args.titleSearch,
  });
  const queryForShopify = query || '';
  /** RELEVANCE only when `query` is non-empty — Shopify forbids RELEVANCE with no search query. */
  const sortKey = queryForShopify.trim() ? 'RELEVANCE' : 'TITLE';

  const { data, errors } = await client.request<OfficeProductsCatalogData>(PRODUCTS_CATALOG, {
    variables: {
      first,
      after: args.after?.trim() || null,
      query: queryForShopify,
      sortKey,
    },
  });
  const errList = Array.isArray(errors) ? errors : errors ? [errors] : [];
  if (errList.length > 0) {
    const msg = errList
      .map((e) =>
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e),
      )
      .join('; ');
    throw new Error(`Shopify products catalog failed: ${msg}`);
  }

  const rows: OfficeCatalogVariantRow[] = [];
  for (const edge of data?.products?.edges ?? []) {
    const p = edge.node;
    const vendor = p.vendor?.trim() || null;
    for (const ve of p.variants.edges) {
      const v = ve.node;
      const imageUrl =
        v.image?.url?.trim() ||
        p.featuredImage?.url?.trim() ||
        null;
      rows.push({
        productId: p.id,
        productTitle: p.title,
        vendor,
        variantId: v.id,
        variantTitle: v.title,
        sku: v.sku,
        price: v.price ?? null,
        imageUrl,
      });
    }
  }

  const pageInfo = data?.products?.pageInfo;
  return {
    rows,
    endCursor: pageInfo?.endCursor ?? null,
    hasNextPage: Boolean(pageInfo?.hasNextPage),
  };
}
