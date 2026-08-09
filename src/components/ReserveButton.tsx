'use client';

import { useState, useTransition } from 'react';
import {
  closeToOthers,
  openToOthers,
  releaseGift,
  reserveGift,
} from '@/lib/reservation-actions';
import type { ReservationView } from '@/lib/secrecy';
import { useErrorText, useT } from '@/lib/i18n/client';
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
  suggestedGoal,
}: {
  giftId: string;
  reservation: ReservationView;
  /**
   * What the pot should aim at, in cents, as best the app knows.
   *
   * The wish's own price when its author gave one, otherwise what was read
   * off the shop. It is a SUGGESTION either way — it becomes a real target
   * only once the person opening the pot has confirmed it.
   */
  suggestedGoal?: number | null;
}) {
  const t = useT();
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Plain text, not cents: it goes straight into an input somebody will edit,
  // and parseMoney on the server accepts "20", "20,50" and "20.50" alike.
  const [goal, setGoal] = useState(
    suggestedGoal != null ? String(suggestedGoal / 100) : '',
  );

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
        {/*
          The goal, asked of the one person who can answer it.
          
          Pre-filled with the price read off the shop, so the common case is a
          glance rather than a decision. They have the link in front of them —
          nobody else does — so a stale promo gets corrected here or nowhere.
        */}
        <label className={styles.goalLabel} htmlFor="pot-goal">
          {t('pot.goalLabel')}
        </label>
        {/* The currency sits beside the field rather than inside the value:
            typed into the input it would have to be parsed back out, and a
            person editing "45 €" tends to delete the wrong half. */}
        <div className={styles.goalRow}>
          <input
            id="pot-goal"
            className={styles.goalInput}
            inputMode="decimal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="—"
          />
          <span className={styles.goalCurrency} aria-hidden>
            €
          </span>
        </div>
        <p className={styles.goalHint}>
          {suggestedGoal ? t('pot.goalFromShop') : t('pot.goalFree')}
        </p>

        <Button
          block
          disabled={pending}
          aria-busy={pending}
          onClick={() => run(() => openToOthers(giftId, goal))}
        >
          {pending ? t('reserve.opening') : t('reserve.openToOthers')}
        </Button>
        <p className={styles.note}>{t('reserve.mineNote')}</p>
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={pending}
          onClick={() => run(() => releaseGift(giftId))}
        >
          {t('reserve.cancel')}
        </button>
        {error && (
          <p className={styles.error} role="alert">
            {errorText(error)}
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
            ? t('reserve.youOpened')
            : t('reserve.someoneOpened')}
        </p>
        {reservation.mine && (
          <button
            type="button"
            className={styles.secondaryAction}
            disabled={pending}
            onClick={() => run(() => closeToOthers(giftId))}
          >
            {t('reserve.takeBack')}
          </button>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {errorText(error)}
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
        {pending ? t('reserve.pending') : t('reserve.cta')}
      </Button>
      <p className={styles.note}>{t('reserve.freeNote')}</p>
      {error && (
        <p className={styles.error} role="alert">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}
