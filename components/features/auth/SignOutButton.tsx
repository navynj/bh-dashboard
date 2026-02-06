import React from 'react';
import { Button } from '../../ui/button';
import { signOut } from '@/lib/auth';

async function signOutAction() {
  'use server';
  await signOut({ redirectTo: '/auth' });
}

const SignOutButton = ({ ...props }) => {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" {...props}>
        Sign out
      </Button>
    </form>
  );
};

export default SignOutButton;
