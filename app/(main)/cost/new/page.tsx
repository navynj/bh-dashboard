import { notFound } from 'next/navigation';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import CostEditor from '@/features/cost/components/editor/CostEditor';

export default async function CostNewPage() {
  const session = await auth();
  if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
    notFound();
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 px-4 py-6">
      <CostEditor />
    </div>
  );
}
