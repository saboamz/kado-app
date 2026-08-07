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

/**
 * A closed choice, wired up like the other fields.
 *
 * Categories are a fixed list because the recommender matches on the value:
 * free text meant "Tech", "tech" and "High-tech" became three buckets nobody
 * shared, and the tier that reads them quietly found less over time. A select
 * makes the constraint visible instead of rejecting the person after they
 * type.
 */
export function SelectField({
  label,
  error,
  hint,
  id,
  options,
  placeholder,
  ...rest
}: Base &
  ComponentProps<'select'> & {
    options: readonly string[];
    /** Shown as the empty choice; omit to make the field effectively required. */
    placeholder?: string;
  }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error && errorId, hint && hintId].filter(Boolean).join(' ') ||
          undefined
        }
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
