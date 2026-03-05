'use client';

import { useCallback, useRef, useState } from 'react';
import type { ConfirmDialogProps } from '@/components/ui/confirm-dialog';

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
};

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string | undefined>();
  const [confirmLabel, setConfirmLabel] = useState<string | undefined>();
  const [cancelLabel, setCancelLabel] = useState<string | undefined>();
  const [variant, setVariant] = useState<'default' | 'destructive'>('default');
  const onConfirmRef = useRef<() => void | Promise<void>>(() => {});

  const openConfirm = useCallback((options: ConfirmOptions) => {
    setTitle(options.title);
    setDescription(options.description);
    setConfirmLabel(options.confirmLabel);
    setCancelLabel(options.cancelLabel);
    setVariant(options.variant ?? 'default');
    onConfirmRef.current = options.onConfirm;
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    await onConfirmRef.current();
  }, []);

  const dialogProps: ConfirmDialogProps = {
    open,
    onOpenChange: setOpen,
    title,
    description,
    confirmLabel,
    cancelLabel,
    variant,
    onConfirm: handleConfirm,
  };

  return { openConfirm, dialogProps };
}
