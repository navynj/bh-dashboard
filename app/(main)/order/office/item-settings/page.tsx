import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { isShopifyAdminEnvConfigured } from '@/lib/shopify/env';
import { fetchShopifyVendorsFromEnv } from '@/lib/shopify/fetchVendors';
import { ItemSettingsClient } from '@/features/order/office/components/ItemSettingsClient';

export const dynamic = 'force-dynamic';

export default async function OfficeItemSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth');
  if (!getOfficeOrAdmin(session.user.role)) redirect('/order/office');

  const shopifyConfigured = isShopifyAdminEnvConfigured();
  let vendors: string[] = [];
  if (shopifyConfigured) {
    try {
      vendors = await fetchShopifyVendorsFromEnv();
    } catch (e) {
      console.error('Failed to fetch Shopify vendors:', e);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Office — Item settings</h1>
        <p className="text-sm text-muted-foreground">
          Browse Shopify catalog variants, filter by vendor, and set default notes. New PO lines use
          these notes automatically; you can still override per line on the PO.
        </p>
      </div>

      <ItemSettingsClient vendors={vendors} shopifyConfigured={shopifyConfigured} />
    </div>
  );
}
