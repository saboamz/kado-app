'use client';

import { useState, useTransition } from 'react';
import { formatMoney } from '@/lib/format';
import { contribute, withdrawContribution } from '@/lib/pot-actions';
import type { PotView } from '@/lib/secrecy';
import { Button } from './Button';
import styles from './pot.module.css';

const QUICK_AMOUNTS = [10, 20, 50, 100];

/**
 * A collaborative gift pot.
 *
 * Shows a total and a contributor count, never who gave what — the same rule
 * as reservations. Rendered only for friends: an owner never receives a
 * PotView at all.
 */
export function Pot({ giftId, pot }: { giftId: string; pot: PotView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const target = pot.targetCents;
  const remaining = target ? Math.max(0, target - pot.raisedCents) : null;
  const percent = target
    ? Math.min(100, Math.round((pot.raisedCents / target) * 100))
    : 0;
  const complete = remaining !== null && remaining === 0;

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setAmount('');
    });
  }

  return (
    <section className={styles.pot} aria-labelledby="pot-heading">
      <h2 id="pot-heading" className={styles.heading}>
        Cagnotte
      </h2>

      <div className={styles.amounts}>
        <span className={styles.raised}>{formatMoney(pot.raisedCents)}</span>
        {target && (
          <span className={styles.target}>
            réunis sur {formatMoney(target)}
          </span>
        )}
      </div>

      {target && (
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={pot.raisedCents}
          aria-label={`Cagnotte à ${percent} %`}
        >
          <div className={styles.fill} style={{ width: `${percent}%` }} />
        </div>
      )}

      <p className={styles.people}>
        {/* A count, never names: who paid what stays between each person and the app. */}
        {pot.contributorCount === 0
          ? 'Personne n’a encore participé.'
          : `${pot.contributorCount} ${
              pot.contributorCount > 1 ? 'personnes participent' : 'personne participe'
            }`}
        {remaining !== null && remaining > 0 && (
          <> · il reste {formatMoney(remaining)}</>
        )}
      </p>

      {pot.myContributionCents > 0 && (
        <p className={styles.mine}>
          Vous avez versé {formatMoney(pot.myContributionCents)}.
        </p>
      )}

      {complete ? (
        <p className={styles.complete}>
          La cagnotte est complète. Le cadeau peut être acheté.
        </p>
      ) : (
        <>
          <div className={styles.quick} role="group" aria-label="Montants rapides">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.quickButton}
                onClick={() => setAmount(String(value))}
              >
                {value} €
              </button>
            ))}
          </div>

          <div className={styles.form}>
            <label className="srOnly" htmlFor="pot-amount">
              Montant de votre participation
            </label>
            <input
              id="pot-amount"
              className={styles.input}
              inputMode="decimal"
              placeholder="Montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button
              disabled={pending || !amount}
              aria-busy={pending}
              onClick={() => run(() => contribute(giftId, amount))}
            >
              {pending ? 'Envoi…' : 'Participer'}
            </Button>
          </div>
        </>
      )}

      {pot.myContributionCents > 0 && (
        <button
          type="button"
          className={styles.withdraw}
          disabled={pending}
          onClick={() => run(() => withdrawContribution(giftId))}
        >
          Retirer ma participation
        </button>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <p className={styles.note}>
        Le propriétaire de la liste ne voit ni le total, ni les participants, ni
        même l’existence de cette cagnotte.
      </p>
    </section>
  );
}
