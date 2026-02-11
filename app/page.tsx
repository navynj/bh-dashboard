import { Spinner } from '@/components/ui/spinner';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

type Props = { searchParams: Promise<{ yearMonth?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  // =================
  // Auth
  // =================
  const session = await auth();
  switch (session?.user?.status) {
    case 'active':
      redirect('/budget');
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
