import Link from 'next/link';
import styles from './auth.module.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <main className={styles.card}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            K
          </span>
          Kadlio
        </Link>
        {children}
      </main>
    </div>
  );
}
