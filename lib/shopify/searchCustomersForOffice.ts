/**
 * Admin GraphQL customer search for office flows (picker, create order). Requires `read_customers`.
 */

import { createAdminApiClient } from '@shopify/admin-api-client';
import { formatShopifyAdminClientErrors } from '@/lib/shopify/format-admin-api-errors';
import { getShopifyAdminEnv } from '@/lib/shopify/env';
import type { ShopifyAdminCredentials } from '@/types/shopify';
import type { ShopifyAdminCustomerNode } from '@/lib/shopify/fetchCustomers';

const CUSTOMERS_SEARCH = `query OfficeCustomersSearch($first: Int!, $query: String) {
  customers(first: $first, query: $query) {
    edges {
      node {
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
        addressesV2(first: 1) {
          edges {
            node {
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
        }
      }
    }
  }
}`;

type SearchData = {
  customers: {
    edges: Array<{ node: ShopifyAdminCustomerNode }>;
  };
};

export async function searchCustomersForOffice(
  creds: ShopifyAdminCredentials,
  query: string,
  first = 20,
): Promise<ShopifyAdminCustomerNode[]> {
  const client = createAdminApiClient({
    storeDomain: creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });

  const { data, errors } = await client.request<SearchData>(CUSTOMERS_SEARCH, {
    variables: { first, query },
  });

  const errText = formatShopifyAdminClientErrors(errors);
  if (errText) {
    throw new Error(`Shopify customers search failed: ${errText}`);
  }

  const edges = data?.customers?.edges ?? [];
  return edges.map((e) => e.node);
}

export function searchCustomersForOfficeFromEnv(query: string, first?: number) {
  return searchCustomersForOffice(getShopifyAdminEnv(), query, first);
}
