'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/list-actions';
import { useT } from '@/lib/i18n/client';
import type { TFunction } from '@/lib/i18n/t';
import { Field } from './Field';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

/*
 * Built from the translator rather than declared as a constant.
 *
 * A module-level array is evaluated once at import, before any component has
 * rendered and therefore before the locale is known — it would freeze
 * whichever language happened to load first for the lifetime of the process.
 */
function visibilities(t: TFunction) {
  return [
    {
      value: 'FRIENDS',
      label: t('visibility.friends'),
      hint: t('visibility.friendsHint'),
    },
    {
      value: 'PRIVATE',
      label: t('visibility.private'),
      hint: t('visibility.privateHint'),
    },
    {
      value: 'PUBLIC',
      label: t('visibility.public'),
      hint: t('visibility.publicHint'),
    },
  ] as const;
}

export function ListForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: { name: string; occasion: string | null; visibility: string };
  submitLabel: string;
  pendingLabel: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className={styles.form} noValidate>
      <Field
        id="name"
        name="name"
        label={t('form.listName')}
        defaultValue={initial?.name}
        placeholder={t('form.listNamePlaceholder')}
        required
        autoFocus={!initial}
        error={state.errors?.name}
      />
      <Field
        id="occasion"
        name="occasion"
        label={t('form.occasion')}
        defaultValue={initial?.occasion ?? ''}
        placeholder={t('form.optional')}
        error={state.errors?.occasion}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('form.whoCanSee')}</legend>
        {visibilities(t).map((v) => (
          <label key={v.value} className={styles.radio}>
            <input
              type="radio"
              name="visibility"
              value={v.value}
              defaultChecked={(initial?.visibility ?? 'FRIENDS') === v.value}
            />
            <span>
              <span className={styles.radioLabel}>{v.label}</span>
              <span className={styles.radioHint}>{v.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
