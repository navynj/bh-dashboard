import OnboardingList from '@/components/features/onboard/OnboardingList';
import { RefreshTokenExpiredAlert } from '@/components/features/locations/RefreshTokenExpiredAlert';
import Header from '@/components/layout/Header';
import { auth, getOfficeOrAdmin, requireActiveSession } from '@/lib/auth';
import { getPendingApprovals } from '@/lib/users';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

const layout = async ({ children }: { children: ReactNode }) => {
  // =================
  // Auth
  // =================
  const session = await auth();
  if (!session?.user) redirect('/auth');
  if (!requireActiveSession(session)) redirect('/onboarding');

  // =================
  // Onboarding
  // =================
  const canApprove =
    session?.user?.role === 'admin' || session?.user?.role === 'office';
  const pending =
    canApprove && session?.user?.role
      ? await getPendingApprovals(session.user.role)
      : [];

  const isOfficeOrAdmin = getOfficeOrAdmin(session?.user?.role);

  return (
    <div className="flex min-h-dvh flex-col w-full min-w-0 max-w-full p-4 md:p-8">
      <main className="flex-1 min-w-0">
        <Header isOfficeOrAdmin={isOfficeOrAdmin} />
        <div className="space-y-6">
          <RefreshTokenExpiredAlert
            isOfficeOrAdmin={isOfficeOrAdmin ?? false}
          />
          <OnboardingList canApprove={canApprove} pending={pending} />
          {children}
        </div>
      </main>
    </div>
  );
};

export default layout;
