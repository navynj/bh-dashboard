import { signIn } from '@/lib/auth';
import { Button } from '../../ui/button';
import google from '@/public/logo/google.svg';
import Image from 'next/image';

async function signInWithGoogle() {
  'use server';
  await signIn('google', { callbackUrl: '/' });
}

const SignInButton = () => {
  return (
    <form action={signInWithGoogle}>
      <Button
        type="submit"
        variant="outline"
        className="flex items-center space-x-2 px-8 py-6 pl-[0.75rem] text-lg font-medium hover:scale-[1.02] hover:bg-transparent"
      >
        <Image src={google} alt="Google logo" width={40} height={40} />
        <p>Continue with Google</p>
      </Button>
    </form>
  );
};

export default SignInButton;
