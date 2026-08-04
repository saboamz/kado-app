'use client';

import { useState, useTransition } from 'react';
import { releaseGift, reserveGift } from '@/lib/reservation-actions';
import type { ReservationView } from '@/lib/secrecy';
import { Button } from './Button';
import styles from './reserve.module.css';

/**
 * Reserve or release a gift.
 *
 * Rendered only for friends: an owner is never handed a ReservationView at
 * all, so there is no state here for their page to fall into.
 */
export function ReserveButton({
  giftId,
  reservation,
}: {
  giftId: string;
  reservation: ReservationView;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  if (reservation.state === 'taken') {
    return (
      <div className={styles.wrap}>
        <Button variant="secondary" block disabled>
          Déjà réservé par un proche
        </Button>
        <p className={styles.note}>
          Un autre invité s&rsquo;en occupe. Vous ne saurez pas qui — et le
          propriétaire non plus.
        </p>
      </div>
    );
  }

  if (reservation.state === 'mine') {
    return (
      <div className={styles.wrap}>
        <Button
          variant="secondary"
          block
          disabled={pending}
          aria-busy={pending}
          onClick={() => run(() => releaseGift(giftId))}
        >
          {pending ? 'Annulation…' : 'Annuler ma réservation'}
        </Button>
        <p className={styles.note}>
          Vous avez réservé ce cadeau. Personne d&rsquo;autre ne peut le prendre,
          et le propriétaire n&rsquo;en sait rien.
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Button
        block
        disabled={pending}
        aria-busy={pending}
        onClick={() => run(() => reserveGift(giftId))}
      >
        {pending ? 'Réservation…' : 'Je réserve ce cadeau'}
      </Button>
      <p className={styles.note}>
        Les autres invités verront qu&rsquo;il est pris, sans savoir par qui. Le
        propriétaire ne verra rien du tout.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
