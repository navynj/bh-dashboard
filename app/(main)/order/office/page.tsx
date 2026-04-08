import { auth } from '@/lib/auth';
import { fetchShopifyOrdersPageFromEnv } from '@/lib/shopify/fetchOrders';
import { isShopifyAdminEnvConfigured } from '@/lib/shopify/env';
import { format, parseISO } from 'date-fns';
import { redirect } from 'next/navigation';
import type { ShopifyOrderNode } from '@/types/shopify';

export const dynamic = 'force-dynamic';

function formatOrderMoney(node: ShopifyOrderNode): string {
  const amount = node.totalPriceSet?.shopMoney?.amount;
  const code =
    node.totalPriceSet?.shopMoney?.currencyCode ?? node.currencyCode ?? 'USD';
  if (amount === undefined || amount === '') return '—';
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n)) return amount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).format(n);
  } catch {
    return `${amount} ${code}`;
  }
}

function formatShopifyDate(iso: string): string {
  try {
    const d = parseISO(iso);
    return format(d, 'yyyy-MM-dd HH:mm');
  } catch {
    return iso;
  }
}

/** Customer profile when linked; otherwise checkout email on the order. */
function formatCustomerCell(o: ShopifyOrderNode): {
  primary: string;
  secondary: string | null;
} {
  const c = o.customer;
  const fallbackEmail = o.email?.trim() || null;
  if (!c) {
    return {
      primary: fallbackEmail ?? '—',
      secondary: null,
    };
  }
  const name =
    c.displayName?.trim() ||
    [c.firstName, c.lastName].filter(Boolean).join(' ').trim() ||
    null;
  const email = c.email?.trim() || fallbackEmail;
  const phone = c.phone?.trim() || null;

  if (name) {
    const bits = [email, phone].filter(Boolean);
    return {
      primary: name,
      secondary: bits.length ? bits.join(' · ') : null,
    };
  }
  if (email) {
    return { primary: email, secondary: phone };
  }
  if (phone) {
    return { primary: phone, secondary: null };
  }
  return { primary: fallbackEmail ?? '—', secondary: null };
}

export default async function OfficeOrderPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth');

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim();

  if (!isShopifyAdminEnvConfigured()) {
    return (
      <div className="max-w-3xl space-y-2">
        <h1 className="text-lg font-semibold">Office — Orders</h1>
        <p className="text-sm text-muted-foreground">
          Shopify connection check: add{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            SHOPIFY_SHOP_DOMAIN
          </code>{' '}
          and{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            SHOPIFY_ADMIN_TOKEN
          </code>{' '}
          to your environment, then reload.
        </p>
      </div>
    );
  }

  let errorMessage: string | null = null;
  let orders: ShopifyOrderNode[] = [];

  try {
    const data = await fetchShopifyOrdersPageFromEnv({ first: 25 });
    orders = data.orders.edges.map((e) => e.node);
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : 'Failed to load orders';
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Office — Orders</h1>
        <p className="text-sm text-muted-foreground">
          Shopify connection:{' '}
          <span className="font-medium text-foreground">{shopDomain}</span>
        </p>
      </div>

      {errorMessage ? (
        <div
          className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Connection OK — no orders returned (store may be empty).
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {orders.length} most recent order
            {orders.length === 1 ? '' : 's'} (first page, max 25).
          </p>
          <div className="relative w-full overflow-auto rounded-md border">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                    Order
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                    Customer
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                    Created
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                    Financial
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                    Fulfillment
                  </th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">
                    Total
                  </th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">
                    Items
                  </th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {orders.map((o) => {
                  const lineCount = o.lineItems.edges.length;
                  const customer = formatCustomerCell(o);
                  return (
                    <tr
                      key={o.id}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <td className="p-2 align-middle font-medium">
                        {o.name ?? o.id}
                      </td>
                      <td className="max-w-[14rem] p-2 align-middle">
                        <div className="font-medium leading-tight">
                          {customer.primary}
                        </div>
                        {customer.secondary ? (
                          <div className="mt-0.5 text-xs text-muted-foreground leading-snug">
                            {customer.secondary}
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap p-2 align-middle text-muted-foreground">
                        {formatShopifyDate(o.createdAt)}
                      </td>
                      <td className="p-2 align-middle">
                        {o.displayFinancialStatus ?? '—'}
                      </td>
                      <td className="p-2 align-middle">
                        {o.displayFulfillmentStatus ?? '—'}
                      </td>
                      <td className="p-2 text-right align-middle tabular-nums">
                        {formatOrderMoney(o)}
                      </td>
                      <td className="p-2 text-right align-middle tabular-nums">
                        {lineCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
