import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import styles from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const classesFor = (variant: Variant, block?: boolean, extra?: string) =>
  [styles.button, styles[variant], block && styles.block, extra]
    .filter(Boolean)
    .join(' ');

export function Button({
  variant = 'primary',
  block,
  className,
  children,
  ...rest
}: ComponentProps<'button'> & {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}) {
  return (
    <button className={classesFor(variant, block, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  block,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}) {
  return (
    <Link className={classesFor(variant, block, className)} {...rest}>
      {children}
    </Link>
  );
}
