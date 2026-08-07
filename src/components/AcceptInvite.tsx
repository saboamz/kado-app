'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { acceptInvite } from '@/lib/invite-actions';
import { Button } from './Button';
import styles from './acceptInvite.module.css';

/**
 * Accepting an invitation, for somebody already signed in.
 *
 * A button rather than something that fires on page load: a link that created
 * a friendship on GET would trigger on every preview crawler that touches it
 * — and these links get pasted into group chats, which is exactly where such
 * crawlers live.
 */
export function AcceptInvite({ code, name }: { code: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className={styles.wrap}>
      <Button
        block
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await acceptInvite(code);
            if (result.error) setError(result.error);
            // Straight to their lists: seeing what there is to offer is the
            // point of accepting.
            else router.push('/friends');
          })
        }
      >
        {pending ? 'Un instant…' : `Devenir ami avec ${name}`}
      </Button>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
