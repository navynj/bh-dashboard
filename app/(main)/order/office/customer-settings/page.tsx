import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/core/prisma';
import {
  CustomerSettingsClient,
  type CustomerRow,
} from '@/features/order/office/components/CustomerSettingsClient';

export const dynamic = 'force-dynamic';

export default async function OfficeCustomerSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth');

  const customers = await prisma.shopifyCustomer.findMany({
    select: {
      id: true,
      displayName: true,
      displayNameOverride: true,
      email: true,
      company: true,
      officePoAccountCode: true,
      shippingAddress: true,
      billingAddress: true,
      billingSameAsShipping: true,
      _count: { select: { orders: true } },
    },
    orderBy: [{ displayNameOverride: 'asc' }, { displayName: 'asc' }],
  });

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Office — Customer Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage display names for Shopify customers. Set a short PO account code per
          customer for suggested PO numbers (e.g. 6107 MA - Millda). Override names are
          used throughout the order management interface.
        </p>
      </div>

      <CustomerSettingsClient customers={customers as CustomerRow[]} />
    </div>
  );
}
