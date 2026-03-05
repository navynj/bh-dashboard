'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FixedSchedulePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/delivery/drivers');
  }, [router]);
  return (
    <div className="py-8 text-muted-foreground">
      Redirecting to Drivers…
    </div>
  );
}
