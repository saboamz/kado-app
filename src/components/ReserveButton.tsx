'use client';

import { useState, useTransition } from 'react';
import {
  closeToOthers,
  openToOthers,
  releaseGift,
  reserveGift,
} from '@/lib/reservation-actions';
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
          block
          disabled={pending}
          aria-busy={pending}
          onClick={() => run(() => openToOthers(giftId))}
        >
          {pending ? 'Ouverture…' : 'Inviter d’autres à participer'}
        </Button>
        <p className={styles.note}>
          Vous avez réservé ce cadeau. Si le prix est élevé, ouvrez-le aux
          autres invités : chacun mettra ce qu&rsquo;il veut, et le propriétaire
          n&rsquo;en saura toujours rien.
        </p>
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={pending}
          onClick={() => run(() => releaseGift(giftId))}
        >
          Annuler ma réservation
        </button>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  /*
   * Open to everyone who can see the list.
   *
   * The person who opened it gets the option to close it again; the others
   * only ever see the pot, which is rendered separately. Neither of them is
   * told who else has joined — a count, never names.
   */
  if (reservation.state === 'open') {
    return (
      <div className={styles.wrap}>
        <p className={styles.note}>
          {reservation.mine
            ? 'Vous avez ouvert ce cadeau aux autres invités. Participez à la cagnotte ci-dessous.'
            : 'Un proche a ouvert ce cadeau à plusieurs. Vous pouvez participer à la cagnotte ci-dessous.'}
        </p>
        {reservation.mine && (
          <button
            type="button"
            className={styles.secondaryAction}
            disabled={pending}
            onClick={() => run(() => closeToOthers(giftId))}
          >
            Le reprendre pour moi seul
          </button>
        )}
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
