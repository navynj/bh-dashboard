'use client';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import type { PendingUser } from '@/lib/onboarding';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  office: 'Office',
  manager: 'Manager',
};

interface PendingApprovalItemProps {
  user: PendingUser;
}

export function PendingApprovalItem({ user }: PendingApprovalItemProps) {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const submitApprove = async (userId: string) => {
    toast.dismiss();
    toast.loading('Approving user...');
    setApprovingId(userId);
    const result = await api('/onboarding/approve', {
      method: 'POST',
      body: { userId },
    });
    setApprovingId(null);
    if (!result.ok) return;
    toast.dismiss();
    toast.success('User approved');
    router.refresh();
  };

  const confirmApprove = (userId: string) => {
    toast('Are you sure you want to approve this user?', {
      description: user.name,
      action: (
        <Button size="xs" onClick={() => submitApprove(userId)}>
          Approve
        </Button>
      ),
    });
  };

  return (
    <li
      key={user.id}
      className="flex flex-wrap items-center justify-between gap-3 border p-4 rounded-md"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{user.name || user.email || '—'}</p>
        <p className="text-muted-foreground text-sm">
          {user.email && user.name ? user.email : null}
          {user.role && (
            <>
              {user.email && user.name ? ' · ' : ''}
              {ROLE_LABELS[user.role] ?? user.role}
              {user.location ? ` · ${user.location}` : ''}
            </>
          )}
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => confirmApprove(user.id)}
        disabled={approvingId !== null}
      >
        {approvingId === user.id ? (
          <>
            <Spinner />
            <span className="sr-only">Approving…</span>
          </>
        ) : (
          'Approve'
        )}
      </Button>
    </li>
  );
}
