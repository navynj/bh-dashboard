import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ContactSettingsClient } from '@/features/order/office/components/ContactSettingsClient';

export const dynamic = 'force-dynamic';

export default async function OfficeContactSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth');

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Office — Contact Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure PO outbound email (saved to the database) and other contact
          preferences for supplier communications.
        </p>
      </div>

      <ContactSettingsClient />
    </div>
  );
}
