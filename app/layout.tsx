import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { NavigationProgressProvider } from '@/components/providers/NavigationProgress';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'BH Budget',
    template: '%s | BH Budget',
  },
  description: 'Budget charts and overview',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense
          fallback={
            <>
              {children}
              <Toaster position="top-center" />
            </>
          }
        >
          <NavigationProgressProvider>
            {children}
            <Toaster position="top-center" />
          </NavigationProgressProvider>
        </Suspense>
      </body>
    </html>
  );
}
