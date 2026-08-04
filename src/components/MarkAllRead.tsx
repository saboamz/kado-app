'use client';

import { useTransition } from 'react';
import { markAllRead } from '@/lib/notification-actions';
import { Button } from './Button';

export function MarkAllRead() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => markAllRead())}
    >
      {pending ? 'Marquage…' : 'Tout marquer comme lu'}
    </Button>
  );
}
