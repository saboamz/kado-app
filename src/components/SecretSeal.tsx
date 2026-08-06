import type { ReactNode } from 'react';
import styles from './secretSeal.module.css';

/**
 * The seal that marks the product's promise.
 *
 * One shape, used in exactly three places, so a friend learns to read it in a
 * single screen:
 *
 *   tone="hidden" (ochre) — what the list owner will never see. On a
 *     reservation control, on a pot, on the secret chat.
 *   tone="guarantee" (grey) — the reassurance given TO the owner, on their own
 *     gift page: nothing was fetched, so there is nothing to hide.
 *
 * The colour split is the message. Ochre is not decoration and belongs to no
 * other component: wherever it appears, something is being kept from the
 * person the screen is about. Reusing it for an unrelated highlight would
 * quietly cost the user the only visual rule they had to learn.
 */
export function SecretSeal({
  tone = 'hidden',
  title,
  children,
}: {
  tone?: 'hidden' | 'guarantee';
  /** Optional bold lead-in, e.g. "Côté amis". */
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.seal} ${styles[tone]}`}>
      <span className={styles.mark} aria-hidden>
        ✻
      </span>
      <span className={styles.body}>
        {title && <strong className={styles.title}>{title}</strong>}
        <span className={styles.text}>{children}</span>
      </span>
    </div>
  );
}

/**
 * The full-bleed ochre zone on a gift page: everything a friend can do that
 * the owner must not see, gathered in one place rather than scattered down
 * the page. The seal above it says why the zone is there.
 */
export function SecretZone({ children }: { children: ReactNode }) {
  return <section className={styles.zone}>{children}</section>;
}
