import SignInButton from '@/components/control/SignInButton';

export default async function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">BH Hub</h1>
      <p className="text-muted-foreground max-w-sm text-center">
        Sign in to view dashboard and manage your location.
      </p>
      <SignInButton />
    </div>
  );
}
