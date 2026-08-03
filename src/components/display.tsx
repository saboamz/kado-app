import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { initials } from '@/lib/format';
import styles from './display.module.css';

export function Card({
  plain,
  className,
  children,
  ...rest
}: ComponentProps<'div'> & { plain?: boolean }) {
  return (
    <div
      className={[styles.card, plain && styles.cardPlain, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardLink({
  plain,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { plain?: boolean }) {
  return (
    <Link
      className={[styles.card, plain && styles.cardPlain, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function Avatar({
  name,
  color = '#FF6A55',
  size = 44,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.38),
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'solid' | 'outline';
  children: ReactNode;
}) {
  const toneClass = {
    neutral: styles.badgeNeutral,
    accent: styles.badgeAccent,
    solid: styles.badgeSolid,
    outline: styles.badgeOutline,
  }[tone];
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
}

/** Priority as stars, with a text label for anyone not seeing them. */
export function PriorityStars({ priority }: { priority: number }) {
  const filled = Math.max(0, Math.min(3, priority));
  return (
    <span className={styles.stars}>
      <span aria-hidden>
        {'★'.repeat(filled)}
        {'☆'.repeat(3 - filled)}
      </span>
      <span className="srOnly">Priorité {filled} sur 3</span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      {icon && <span className={styles.emptyIcon}>{icon}</span>}
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyBody}>{body}</p>
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}
