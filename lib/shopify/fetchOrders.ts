import { createAdminApiClient } from '@shopify/admin-api-client';
import { formatShopifyAdminClientErrors } from '@/lib/shopify/format-admin-api-errors';
import { getShopifyAdminEnv } from '@/lib/shopify/env';
import type {
  ShopifyAdminCredentials,
  ShopifyOrderNode,
  ShopifyOrdersQueryData,
} from '@/types/shopify';

/**
 * Bulk `orders` query: keep line item selection shallow so the query stays under
 * Shopify’s per-request cost limit (~1000). Deep media lives in
 * `ORDER_LINE_ITEM_SELECTION_DETAIL` (single-order fetch only).
 */
const ORDER_LINE_ITEM_SELECTION_SYNC = `
              id
              title
              quantity
              sku
              vendor
              image { url }
              discountedUnitPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              variant {
                id
                title
                sku
                image { url }
                product {
                  featuredImage { url }
                }
                inventoryItem {
                  unitCost {
                    amount
                  }
                }
              }
`;

/** Single `node(id:)` order — richer media for `image_url` when cost is amortized per order. */
const ORDER_LINE_ITEM_SELECTION_DETAIL = `
              id
              title
              quantity
              sku
              vendor
              image { url }
              discountedUnitPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              product {
                featuredImage { url }
                featuredMedia {
                  ... on MediaImage {
                    image { url }
                    preview { image { url } }
                  }
                }
                media(first: 8) {
                  edges {
                    node {
                      ... on MediaImage {
                        image { url }
                      }
                    }
                  }
                }
              }
              variant {
                id
                title
                sku
                image { url }
                media(first: 8) {
                  edges {
                    node {
                      ... on MediaImage {
                        image { url }
                      }
                    }
                  }
                }
                product {
                  featuredImage { url }
                  featuredMedia {
                    ... on MediaImage {
                      image { url }
                      preview { image { url } }
                    }
                  }
                  media(first: 8) {
                    edges {
                      node {
                        ... on MediaImage {
                          image { url }
                        }
                      }
                    }
                  }
                }
                inventoryItem {
                  unitCost {
                    amount
                  }
                }
              }
`;

const ORDERS_QUERY = `query Orders($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true, query: $query) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        name
        email
        customer {
          id
          displayName
          firstName
          lastName
          email
          phone
          defaultAddress {
            address1
            address2
            city
            province
            provinceCode
            country
            zip
            company
            name
            phone
          }
        }
        processedAt
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        currencyCode
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        billingAddress {
          address1
          address2
          city
          province
          provinceCode
          country
          zip
          company
          name
          phone
        }
        shippingAddress {
          address1
          address2
          city
          province
          provinceCode
          country
          zip
          company
          name
          phone
        }
        lineItems(first: 250) {
          edges {
            node {
${ORDER_LINE_ITEM_SELECTION_SYNC}
            }
          }
        }
      }
    }
  }
}`;

/** Single order by GID — same shape as list `orders` nodes (for re-sync after edits). */
const ORDER_NODE_QUERY = `query OrderNode($id: ID!) {
  node(id: $id) {
    ... on Order {
      id
      name
      email
      customer {
        id
        displayName
        firstName
        lastName
        email
        phone
        defaultAddress {
          address1
          address2
          city
          province
          provinceCode
          country
          zip
          company
          name
          phone
        }
      }
      processedAt
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      currencyCode
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      billingAddress {
        address1
        address2
        city
        province
        provinceCode
        country
        zip
        company
        name
        phone
      }
      shippingAddress {
        address1
        address2
        city
        province
        provinceCode
        country
        zip
        company
        name
        phone
      }
      lineItems(first: 250) {
        edges {
          node {
${ORDER_LINE_ITEM_SELECTION_DETAIL}
          }
        }
      }
    }
  }
}`;

export type OrderNodeQueryData = {
  node: ShopifyOrderNode | null;
};

export async function fetchShopifyOrderNodeByGid(
  creds: ShopifyAdminCredentials,
  orderGid: string,
): Promise<ShopifyOrderNode | null> {
  const client = createAdminApiClient({
    storeDomain: creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });

  const { data, errors } = await client.request<OrderNodeQueryData>(ORDER_NODE_QUERY, {
    variables: { id: orderGid },
  });

  const errList = Array.isArray(errors) ? errors : errors ? [errors] : [];
  if (errList.length > 0) {
    const msg = errList
      .map((e) =>
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e),
      )
      .join('; ');
    throw new Error(`Shopify order node query failed: ${msg}`);
  }

  return data?.node ?? null;
}

export function fetchShopifyOrderNodeByGidFromEnv(orderGid: string) {
  return fetchShopifyOrderNodeByGid(getShopifyAdminEnv(), orderGid);
}

export type FetchShopifyOrdersPageOptions = {
  first?: number;
  after?: string | null;
  /** Shopify search query filter (e.g. `updated_at:>'2024-01-01'`). */
  query?: string;
};

/**
 * Fetches one page of orders from Shopify Admin GraphQL API.
 */
export async function fetchShopifyOrdersPage(
  creds: ShopifyAdminCredentials,
  options: FetchShopifyOrdersPageOptions = {}
): Promise<ShopifyOrdersQueryData> {
  const { first = 25, after, query } = options;
  const client = createAdminApiClient({
    storeDomain: creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });

  const { data, errors } = await client.request<ShopifyOrdersQueryData>(ORDERS_QUERY, {
    variables: { first, after: after ?? undefined, query: query ?? undefined },
  });

  const errText = formatShopifyAdminClientErrors(errors);
  if (errText) {
    throw new Error(`Shopify orders query failed: ${errText}`);
  }

  if (!data?.orders) {
    throw new Error('Shopify orders query returned no data');
  }

  return data;
}

export type FetchAllShopifyOrdersOptions = {
  pageSize?: number;
  /** Safety cap on GraphQL pages (default 100). */
  maxPages?: number;
  /** Shopify search query filter (e.g. `updated_at:>'2024-01-01'`). */
  query?: string;
  /** Abort between pages (e.g. client cancelled full sync). */
  signal?: AbortSignal;
  /** Fires after each GraphQL page is merged (1-based `pageIndex`). */
  onPage?: (info: { pageIndex: number; cumulativeOrders: number }) => void | Promise<void>;
};

/**
 * Paginates in memory (no DB): current Shopify order list, up to `maxPages` × `pageSize` rows.
 */
export async function fetchAllShopifyOrders(
  creds: ShopifyAdminCredentials,
  options: FetchAllShopifyOrdersOptions = {}
): Promise<{ orders: ShopifyOrderNode[]; pagesFetched: number }> {
  const pageSize = options.pageSize ?? 50;
  const maxPages = options.maxPages ?? 100;
  const query = options.query;
  const signal = options.signal;
  const onPage = options.onPage;
  let after: string | null = null;
  const orders: ShopifyOrderNode[] = [];
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    if (signal?.aborted) {
      throw new DOMException('Shopify orders fetch aborted', 'AbortError');
    }
    const data = await fetchShopifyOrdersPage(creds, { first: pageSize, after, query });
    for (const edge of data.orders.edges) {
      orders.push(edge.node);
    }
    pagesFetched += 1;
    await onPage?.({ pageIndex: pagesFetched, cumulativeOrders: orders.length });
    if (!data.orders.pageInfo.hasNextPage || !data.orders.pageInfo.endCursor) {
      break;
    }
    after = data.orders.pageInfo.endCursor;
  }

  return { orders, pagesFetched };
}

/** One page of orders using `SHOPIFY_SHOP_DOMAIN` / `SHOPIFY_ADMIN_TOKEN` / `SHOPIFY_API_VERSION`. */
export function fetchShopifyOrdersPageFromEnv(
  options: FetchShopifyOrdersPageOptions = {},
) {
  return fetchShopifyOrdersPage(getShopifyAdminEnv(), options);
}

/** All pages (in memory) using env credentials. */
export function fetchAllShopifyOrdersFromEnv(
  options: FetchAllShopifyOrdersOptions = {},
) {
  return fetchAllShopifyOrders(getShopifyAdminEnv(), options);
}
