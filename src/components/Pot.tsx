'use client';

import { useState, useTransition } from 'react';
import { formatMoney } from '@/lib/format';
import {
  contribute,
  declarePurchase,
  undoPurchase,
  withdrawContribution,
} from '@/lib/pot-actions';
import type { PotView } from '@/lib/secrecy';
import { useErrorText, useLocale, useT } from '@/lib/i18n/client';
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
  const t = useT();
  const locale = useLocale();
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  /*
   * Which action is running, not merely that one is.
   *
   * useTransition reports a single flag for every transition started from it,
   * so contributing used to grey out "J'ai acheté" and "Retirer" as well, and
   * relabel a button that had nothing to do with the click. Every control
   * still disables while anything is in flight — one at a time is the rule —
   * but only the one that was pressed says so.
   */
  const [running, setRunning] = useState<
    null | 'contribute' | 'withdraw' | 'declare' | 'undo'
  >(null);

  const target = pot.targetCents;
  const remaining = target ? Math.max(0, target - pot.raisedCents) : null;
  const percent = target
    ? Math.min(100, Math.round((pot.raisedCents / target) * 100))
    : 0;
  const complete = remaining !== null && remaining === 0;

  function run(
    which: 'contribute' | 'withdraw' | 'declare' | 'undo',
    action: () => Promise<{ error?: string }>,
  ) {
    setError(null);
    setRunning(which);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setAmount('');
      setRunning(null);
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
        {t('pot.heading')}
      </h2>

      <p className={styles.amounts}>
        <span className={styles.raised}>{formatMoney(pot.raisedCents, undefined, locale)}</span>
        {target && (
          <span className={styles.target}>
            {' '}
            {t('pot.raisedOf', { target: formatMoney(target, undefined, locale) })}
          </span>
        )}
      </p>

      {/* The bar measures progress towards a goal. Once somebody has paid,
          there is no progress left to make — what remains is settling up. */}
      {target && !pot.buyer && (
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={pot.raisedCents}
          aria-label={t('pot.progress', { percent })}
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
            ? t('pot.nobodyYet')
            : t('pot.participants', { count: pot.contributorCount })}
          {/* Dropped once the gift is paid for: "il reste 15 €" describes a
              pot that is still collecting, and this one has closed. What is
              missing is now the buyer's to carry, which the breakdown says. */}
          {!pot.buyer && remaining !== null && remaining > 0 && (
            <> · {t('pot.remaining', { amount: formatMoney(remaining, undefined, locale) })}</>
          )}
        </span>
      </p>

      {pot.myContributionCents > 0 && (
        <p className={styles.mine}>
          {t('pot.yourShare')}{' '}
          <strong>{formatMoney(pot.myContributionCents, undefined, locale)}</strong>
        </p>
      )}

      {/*
        Who paid, and what that means for whoever is reading.
        
        The buyer gets the breakdown because they are out of pocket for the
        whole amount and have to be able to chase it. Everybody else gets the
        one line that concerns them.
      */}
      {pot.buyer && (
        <div className={styles.purchase}>
          {pot.buyer.isMe ? (
            <>
              <p className={styles.purchaseTitle}>{t('pot.boughtByMe')}</p>
              {pot.owed && pot.owed.length > 0 ? (
                <>
                  <ul className={styles.owed}>
                    {pot.owed.map((person) => (
                      <li key={person.name + person.amountCents}>
                        <span>{person.name}</span>
                        <strong>
                          {formatMoney(person.amountCents, undefined, locale)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.owedTotal}>
                    {t('pot.owedTotal', {
                      amount: formatMoney(
                        pot.owed.reduce((sum, p) => sum + p.amountCents, 0),
                        undefined,
                        locale,
                      ),
                    })}
                  </p>
                </>
              ) : (
                <p className={styles.purchaseNote}>{t('pot.nobodyOwes')}</p>
              )}

              {/* The way back. Pressing "I bought it" by mistake used to be
                  final: the pot closed, nobody could top it up, and a pot
                  short of its goal stayed short. */}
              <button
                type="button"
                className={styles.undo}
                disabled={pending}
                aria-busy={running === 'undo'}
                onClick={() => run('undo', () => undoPurchase(giftId))}
              >
                {running === 'undo' ? t('pot.undoing') : t('pot.undo')}
              </button>
              <p className={styles.purchaseNote}>{t('pot.reopenNote')}</p>
            </>
          ) : (
            <>
              <p className={styles.purchaseTitle}>
                {t('pot.boughtBy', { name: pot.buyer.name })}
              </p>
              {pot.myContributionCents > 0 && (
                <p className={styles.purchaseNote}>
                  {t('pot.youOwe', {
                    amount: formatMoney(pot.myContributionCents, undefined, locale),
                  })}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/*
        Offered only to somebody already in the pot, and only while nobody
        has claimed it. Without a contribution, the breakdown would be one
        click away for anyone who can see the gift — no risk taken, every
        name and amount on screen.
      */}
      {!pot.buyer && pot.myContributionCents > 0 && (
        <div className={styles.purchase}>
          <button
            type="button"
            className={styles.declare}
            disabled={pending}
            aria-busy={running === 'declare'}
            onClick={() => {
              /*
               * Asked before, not explained after.
               *
               * This closes the pot, locks withdrawals and reveals every name
               * and amount to whoever pressed it. The shortfall is spelled
               * out because that is the expensive mistake: closing a pot
               * 15 € short means paying that 15 € yourself, and nothing on
               * screen said so.
               */
              const short =
                pot.targetCents != null
                  ? Math.max(0, pot.targetCents - pot.raisedCents)
                  : 0;
              const message =
                short > 0
                  ? t('pot.confirmShort', {
                      amount: formatMoney(short, undefined, locale),
                    })
                  : t('pot.confirmFull');
              if (!confirm(message)) return;

              run('declare', () => declarePurchase(giftId));
            }}
          >
            {running === 'declare' ? t('pot.declaring') : t('pot.iBought')}
          </button>
          <p className={styles.purchaseNote}>{t('pot.buyerHintNew')}</p>
        </div>
      )}

      {/*
        Once somebody has paid, the pot stops taking promises.
        
        The money is out of their pocket and the amount is fixed; a new
        contribution now would change a total nobody is collecting against
        any more, and the "withdraw" link would let somebody take back what
        they owe a friend who has already paid for them.
      */}
      {pot.buyer ? (
        <p className={styles.settled}>
          {pot.buyer.isMe
            ? t('pot.settledNoteMine')
            : t('pot.settledNote', { name: pot.buyer.name })}
        </p>
      ) : complete ? (
        <p className={styles.complete}>
          <span aria-hidden>✓</span>
          {t('pot.complete')}
        </p>
      ) : (
        <>
          <div className={styles.quick} role="group" aria-label={t('pot.quickAmounts')}>
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.quickButton}
                aria-pressed={amount === String(value)}
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
              placeholder={t('pot.amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button
              disabled={pending || !amount}
              aria-busy={running === 'contribute'}
              onClick={() => run('contribute', () => contribute(giftId, amount))}
            >
              {running === 'contribute'
                ? t('pot.contributing')
                : t('pot.contribute')}
            </Button>
          </div>
        </>
      )}

      {/* Hidden once the gift is paid for, because the action refuses it
          then — withdrawing would be taking back what you owe a friend who
          already put the money down. A button that always errors is worse
          than no button. */}
      {pot.myContributionCents > 0 && !pot.buyer && (
        <button
          type="button"
          className={styles.withdraw}
          disabled={pending}
          aria-busy={running === 'withdraw'}
          onClick={() => run('withdraw', () => withdrawContribution(giftId))}
        >
          {running === 'withdraw' ? t('pot.withdrawing') : t('pot.withdraw')}
        </button>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {errorText(error)}
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
