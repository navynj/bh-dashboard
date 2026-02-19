'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import type { PendingUser } from '@/lib/users';
import { cn } from '@/lib/utils';
import { ClassName } from '@/types/className';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  office: 'Office',
  manager: 'Manager',
};

interface PendingApprovalItemProps extends ClassName {
  user: PendingUser;
}

export function PendingApprovalItem({
  user,
  className,
}: PendingApprovalItemProps) {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [showRejectInputForId, setShowRejectInputForId] = useState<
    string | null
  >(null);
  const [rejectReason, setRejectReason] = useState('');

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

  const openRejectInput = (userId: string) => {
    setShowRejectInputForId(userId);
    setRejectReason('');
  };

  const submitReject = async (userId: string) => {
    toast.dismiss();
    toast.loading('Rejecting user...');
    setRejectingId(userId);
    const result = await api('/onboarding/reject', {
      method: 'POST',
      body: { userId, reason: rejectReason.trim() || undefined },
    });
    setRejectingId(null);
    setShowRejectInputForId(null);
    setRejectReason('');
    if (!result.ok) return;
    toast.dismiss();
    toast.success('User rejected');
    router.refresh();
  };

  const cancelReject = () => {
    setShowRejectInputForId(null);
    setRejectReason('');
  };

  const isBusy = approvingId !== null || rejectingId !== null;
  const showRejectForm = showRejectInputForId === user.id;

  return (
    <li
      key={user.id}
      className={cn(
        'flex flex-col gap-3 border p-4 rounded-md bg-white/75',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openRejectInput(user.id)}
            disabled={isBusy || showRejectForm}
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => confirmApprove(user.id)}
            disabled={isBusy || showRejectForm}
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
        </div>
      </div>
      {showRejectForm && (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
          <label className="text-sm font-medium text-muted-foreground">
            Reject reason (optional)
          </label>
          <Input
            placeholder="e.g. Missing documentation"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            disabled={rejectingId === user.id}
            className="max-w-md"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelReject}
              disabled={rejectingId !== null}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => submitReject(user.id)}
              disabled={rejectingId !== null}
            >
              {rejectingId === user.id ? (
                <>
                  <Spinner />
                  <span className="sr-only">Rejecting…</span>
                </>
              ) : (
                'Submit reject'
              )}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
