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

  // The bar is split in two: what everybody else put in, and your own share.
  // That split is the only nominative thing the design allows here — your own
  // figure is yours to know, and nobody else's can be inferred from it.
  const othersCents = Math.max(0, pot.raisedCents - pot.myContributionCents);
  const othersPercent = target
    ? Math.min(100, (othersCents / target) * 100)
    : 0;
  const minePercent = target
    ? Math.min(100 - othersPercent, (pot.myContributionCents / target) * 100)
    : 0;

  return (
    <section className={styles.pot} aria-labelledby="pot-heading">
      <h2 id="pot-heading" className={styles.heading}>
        Cagnotte
      </h2>

      <p className={styles.amounts}>
        <span className={styles.raised}>{formatMoney(pot.raisedCents)}</span>
        {target && (
          <span className={styles.target}>
            {' '}
            réunis sur {formatMoney(target)}
          </span>
        )}
      </p>

      {target && (
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={pot.raisedCents}
          aria-label={`Cagnotte à ${percent} %`}
        >
          <span className={styles.fill} style={{ width: `${othersPercent}%` }} />
          <span className={styles.fillMine} style={{ width: `${minePercent}%` }} />
        </div>
      )}

      <p className={styles.people}>
        {/*
          A count and anonymous dots, never names or initials: who paid what
          stays between each person and the app.
        */}
        {pot.contributorCount > 0 && (
          <span className={styles.dots} aria-hidden>
            {Array.from({ length: Math.min(5, pot.contributorCount) }).map(
              (_, i) => (
                <span key={i} className={styles.dot} />
              ),
            )}
          </span>
        )}
        <span>
          {pot.contributorCount === 0
            ? 'Personne n’a encore participé.'
            : `${pot.contributorCount} ${
                pot.contributorCount > 1
                  ? 'personnes participent'
                  : 'personne participe'
              }`}
          {remaining !== null && remaining > 0 && (
            <> · il reste {formatMoney(remaining)}</>
          )}
        </span>
      </p>

      {pot.myContributionCents > 0 && (
        <p className={styles.mine}>
          Votre part : <strong>{formatMoney(pot.myContributionCents)}</strong>
        </p>
      )}

      {complete ? (
        <p className={styles.complete}>
          <span aria-hidden>✓</span>
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

      {/*
        The secrecy note used to live here. It now sits once at the top of the
        ochre zone that contains this pot, so a friend reads the rule for the
        whole region instead of the same sentence three times down one page.
      */}
    </section>
  );
}
