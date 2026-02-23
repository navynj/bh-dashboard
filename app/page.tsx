import { Spinner } from '@/components/ui/spinner';
import { auth, getCanSeeBudgetAndReports } from '@/lib/auth';
import { redirect } from 'next/navigation';

type Props = { searchParams: Promise<{ yearMonth?: string }> };

export default async function HomePage() {
  // =================
  // Auth
  // =================
  const session = await auth();
  switch (session?.user?.status) {
    case 'active':
      redirect(
        getCanSeeBudgetAndReports(session.user.role) ? '/budget' : '/delivery',
      );
    case 'pending_approval':
      redirect('/waiting');
    case 'pending_onboarding':
      redirect('/onboarding');
    case 'rejected':
      redirect('/rejected');
      return <Spinner />;
    default:
      redirect('/auth');
  }
}
