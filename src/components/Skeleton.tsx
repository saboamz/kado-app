import styles from './Skeleton.module.css';

/**
 * The placeholder a route shows while its data is on the way.
 *
 * Announced as busy rather than read out: the individual blocks mean nothing
 * spoken, and a screen reader listing four empty boxes is worse than one
 * "chargement" it can move past.
 */
export function PageSkeleton({
  rows = 4,
  subtitle = true,
  label,
}: {
  /** How many content rows to suggest before the real ones arrive. */
  rows?: number;
  subtitle?: boolean;
  /** Translated by the caller, which can read the locale. */
  label: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="srOnly">{label}</span>

      <div className={styles.header} aria-hidden>
        <div className={`${styles.block} ${styles.title}`} />
        {subtitle && <div className={`${styles.block} ${styles.subtitle}`} />}
      </div>

      <div className={styles.rows} aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`${styles.block} ${styles.row}`} />
        ))}
      </div>
    </div>
  );
}
