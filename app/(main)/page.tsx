import OnboardingList from '@/components/features/onboard/OnboardingList';
import { auth } from '@/lib/auth';
import { getPendingApprovals } from '@/lib/onboarding';

export default async function DashboardPage() {
  const session = await auth();
  const canApprove =
    session?.user?.role === 'admin' || session?.user?.role === 'office';
  const pending =
    canApprove && session?.user?.role
      ? await getPendingApprovals(session.user.role)
      : [];

  return (
    <div className="space-y-6">
      <OnboardingList canApprove={canApprove} pending={pending} />
    </div>
  );
}
