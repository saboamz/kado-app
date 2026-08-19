'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  createLifeEvent,
  deleteLifeEvent,
  type FormState,
} from '@/lib/life-event-actions';
import { useErrorText, useLocale, useT } from '@/lib/i18n/client';
import type { TFunction } from '@/lib/i18n/t';
import { Button } from './Button';
import { Field, SelectField } from './Field';
import { SubmitButton } from './SubmitButton';
import styles from './lifeEvents.module.css';

export type LifeEventRow = {
  id: string;
  label: string;
  day: number;
  month: number;
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
};

/*
 * Built from the translator rather than a module constant, for the same
 * reason ListForm does it: a constant is evaluated at import, before the
 * locale is known.
 */
function visibilities(t: TFunction) {
  return [
    { value: 'FRIENDS', label: t('visibility.friends') },
    { value: 'PRIVATE', label: t('visibility.private') },
    { value: 'PUBLIC', label: t('visibility.public') },
  ] as const;
}

/**
 * Month names in the reader's own language.
 *
 * Intl rather than a hardcoded list: the app already ships two locales, and a
 * French array would print "janvier" to an English reader. The year is
 * arbitrary — only the month name is read out of it.
 */
function monthNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
}

/**
 * The dates somebody publishes about themselves.
 *
 * Free text and a day-and-month, because the app has no business deciding
 * which dates matter to a person or what they are called. The old profile
 * offered one field, "date de naissance", and nothing else.
 */
export function LifeEvents({ events }: { events: LifeEventRow[] }) {
  const t = useT();
  const months = monthNames(useLocale());
  const [state, formAction] = useActionState<FormState, FormData>(
    createLifeEvent,
    {},
  );

  return (
    <div className={styles.wrap}>
      {events.length === 0 ? (
        <p className={styles.empty}>{t('events.none')}</p>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      )}

      <form action={formAction} className={styles.form}>
        <Field
          id="event-label"
          name="label"
          label={t('events.label')}
          placeholder={t('events.labelPlaceholder')}
          hint={t('events.labelHint')}
          error={state.errors?.label}
          maxLength={60}
          required
        />

        <div className={styles.date}>
          <SelectField
            id="event-day"
            name="day"
            label={t('events.day')}
            options={Array.from({ length: 31 }, (_, i) => String(i + 1))}
            error={state.errors?.day}
            defaultValue="1"
          />
          <SelectField
            id="event-month"
            name="month"
            label={t('events.month')}
            options={months.map((label, i) => ({
              value: String(i + 1),
              label,
            }))}
            error={state.errors?.month}
            defaultValue="1"
          />
        </div>

        <SelectField
          id="event-visibility"
          name="visibility"
          label={t('events.visibility')}
          options={visibilities(t)}
          defaultValue="FRIENDS"
          error={state.errors?.visibility}
        />

        <SubmitButton pendingLabel={t('events.adding')} block={false}>
          {t('events.add')}
        </SubmitButton>
      </form>
    </div>
  );
}

function EventRow({ event }: { event: LifeEventRow }) {
  const t = useT();
  const months = monthNames(useLocale());
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className={styles.row}>
      <span className={styles.label}>{event.label}</span>
      <span className={styles.when}>
        {event.day} {months[event.month - 1]}
      </span>
      <button
        type="button"
        className={styles.remove}
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await deleteLifeEvent(event.id);
            if (result.errors?.label) {
              setError(errorText(result.errors.label) ?? null);
            }
          })
        }
      >
        {t('events.delete')}
      </button>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </li>
  );
}
