import { UploadedImage } from './UploadedImage';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { avatarTint, initials, priorityLabel } from '@/lib/format';
import type { TFunction } from '@/lib/i18n/t';
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

/**
 * A person, as a photo or as their initials.
 *
 * The tint is derived from the name rather than read from the stored
 * `avatarColor`: the design pairs a light background with dark text of the
 * same hue, and the stored values are saturated hexes from the previous
 * palette (one of them near-black) that cannot carry dark text. Deriving keeps
 * a person's colour stable without a migration. `color` is still accepted so a
 * caller can override, but nothing does today.
 */
export function Avatar({
  name,
  color,
  size = 44,
  url,
}: {
  name: string;
  color?: string;
  size?: number;
  /** An uploaded photo; the coloured initials stand in when absent. */
  url?: string | null;
}) {
  if (url) {
    return (
      <UploadedImage
        src={url}
        className={styles.avatarImage}
        width={size}
        height={size}
      />
    );
  }

  const tint = avatarTint(name);

  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        background: color ?? tint.bg,
        color: color ? '#fff' : tint.fg,
        fontSize: Math.round(size * 0.34),
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/**
 * `secret` is the ochre tone, and it is reserved for the one thing ochre
 * means: a reservation the list owner will never see. `muted` is its
 * counterpart for a gift taken by someone else — deliberately quieter, since
 * it is not yours and not actionable.
 */
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'solid' | 'outline' | 'secret' | 'muted';
  children: ReactNode;
}) {
  const toneClass = {
    neutral: styles.badgeNeutral,
    accent: styles.badgeAccent,
    solid: styles.badgeSolid,
    outline: styles.badgeOutline,
    secret: styles.badgeSecret,
    muted: styles.badgeMuted,
  }[tone];
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
}

/**
 * Priority: three bars and the words for them.
 *
 * The design's rule is that the bars are never shown alone — a filled-bar
 * count is a poor signal for anyone who does not distinguish the shades, and
 * "Ça me ferait très plaisir" is the part that actually helps someone choose.
 * `compact` drops the visible label in dense list rows, where the accessible
 * name still carries it.
 */
export function Priority({
  priority,
  compact = false,
  t,
}: {
  priority: number;
  compact?: boolean;
  /** Handed down from the page: this renders on the server, where the
      request's translator has already been resolved. */
  t: TFunction;
}) {
  const filled = Math.max(0, Math.min(3, priority));
  const label = priorityLabel(filled, t);

  return (
    <span className={styles.priority}>
      <span className={styles.bars} aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={styles.bar}
            data-on={n <= filled ? '' : undefined}
          />
        ))}
      </span>
      {compact ? (
        <span className="srOnly">{label}</span>
      ) : (
        <span className={styles.priorityLabel}>{label}</span>
      )}
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
