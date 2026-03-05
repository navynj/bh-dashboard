'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeliveryDailyPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/delivery/overview');
  }, [router]);
  return (
    <div className="py-8 text-muted-foreground">Redirecting to Overview…</div>
  );
}
