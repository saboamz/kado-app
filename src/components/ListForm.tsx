'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/list-actions';
import { Field } from './Field';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

const VISIBILITIES = [
  {
    value: 'FRIENDS',
    label: 'Mes amis',
    hint: 'Seuls vos amis voient cette liste.',
  },
  {
    value: 'PRIVATE',
    label: 'Personne',
    hint: 'Visible par vous seul, pour préparer tranquillement.',
  },
  {
    value: 'PUBLIC',
    label: 'Tout le monde',
    hint: 'Accessible à quiconque a le lien.',
  },
] as const;

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
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className={styles.form} noValidate>
      <Field
        id="name"
        name="name"
        label="Nom de la liste"
        defaultValue={initial?.name}
        placeholder="Anniversaire, Noël, Mariage…"
        required
        autoFocus={!initial}
        error={state.errors?.name}
      />
      <Field
        id="occasion"
        name="occasion"
        label="Occasion"
        defaultValue={initial?.occasion ?? ''}
        placeholder="Facultatif"
        error={state.errors?.occasion}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Qui peut voir cette liste ?</legend>
        {VISIBILITIES.map((v) => (
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
