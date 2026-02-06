import { prisma } from '@/lib/prisma';
import { OnboardingForm } from '../../../components/features/onboard/OnboardingForm';
import { Button } from '@/components/ui/button';
import SignOutButton from '@/components/features/auth/SignOutButton';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth');

  const locations = await prisma.location.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 flex flex-col items-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Complete your profile</h1>
          <p className="mt-1 text-muted-foreground">
            Set your name, role, and location so we can personalize your
            experience.
          </p>
        </div>
        <OnboardingForm
          locations={locations}
          className="w-full"
          userName={session.user.name}
        />
        <SignOutButton variant="ghost" />
      </div>
    </div>
  );
}
