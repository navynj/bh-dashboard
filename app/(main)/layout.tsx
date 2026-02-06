import Header from '@/components/layout/Header';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import React from 'react';

const layout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col p-4 md:p-8">
      <main className="flex-1">
        <Header />
        {children}
      </main>
    </div>
  );
};

export default layout;
