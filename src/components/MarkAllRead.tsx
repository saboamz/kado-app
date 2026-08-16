'use client';

import { useState, useTransition } from 'react';
import { useT } from '@/lib/i18n/client';
import { markAllRead } from '@/lib/notification-actions';
import { Button } from './Button';

export function MarkAllRead() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  /*
   * markAllRead returns void, so a failure arrives as a thrown error rather
   * than an { error } field. Without the catch the rejection was swallowed by
   * the transition and the badge simply never cleared, which is
   * indistinguishable from success.
   */
  return (
    <>
      <Button
        variant="secondary"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setFailed(false);
            try {
              await markAllRead();
            } catch {
              setFailed(true);
            }
          })
        }
      >
        {pending ? t('notifications.markingAll') : t('notifications.markAll')}
      </Button>
      {failed && <p role="alert">{t('notifications.markAllFailed')}</p>}
    </>
  );
}
