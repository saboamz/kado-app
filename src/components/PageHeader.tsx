import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from './icons';
import styles from './PageHeader.module.css';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <>
      {back && (
        <Link href={back.href} className={styles.back}>
          <ChevronLeftIcon size={18} />
          {back.label}
        </Link>
      )}
      <div className={styles.header}>
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </>
  );
}
