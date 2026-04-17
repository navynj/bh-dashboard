import { NavigationProgressProvider } from '@/components/providers/NavigationProgress';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'BH Hub',
    template: '%s | BH Hub',
  },
  description: 'BH Hub',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html lang="en">
      <body className="antialiased">
        <Suspense fallback={null}>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <SessionProvider>
                <TooltipProvider>
                  <NavigationProgressProvider>
                    {children}
                    <Toaster position="top-center" />
                  </NavigationProgressProvider>
                </TooltipProvider>
              </SessionProvider>
            </QueryProvider>
          </NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
