import type { ComponentProps, ReactNode } from 'react';
import styles from './ui.module.css';

type Base = { label: string; error?: string; hint?: ReactNode; id: string };

/** Text input with its label, error and hint wired up for screen readers. */
export function Field({
  label,
  error,
  hint,
  id,
  ...rest
}: Base & ComponentProps<'input'>) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error && errorId, hint && hintId].filter(Boolean).join(' ') ||
          undefined
        }
        {...rest}
      />
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

export function TextareaField({
  label,
  error,
  hint,
  id,
  ...rest
}: Base & ComponentProps<'textarea'>) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
      {error && (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
