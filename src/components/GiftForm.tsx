'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/gift-actions';
import { PRIORITY_LABELS } from '@/lib/format';
import { Field, TextareaField } from './Field';
import { ImageUpload } from './ImageUpload';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

// Derived from the one label table, so the wording a person picks here is
// literally the wording shown back to them on the gift. They used to be two
// separate lists that had already drifted: level 2 read "J'en ai envie" in
// this form and "J'en ai vraiment envie" everywhere else.
const PRIORITIES = [3, 2, 1].map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

export type GiftInitial = {
  name: string;
  description: string | null;
  priceCents: number | null;
  url: string | null;
  merchant: string | null;
  category: string | null;
  priority: number;
  isPot: boolean;
  imageUrl: string | null;
};

export function GiftForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: GiftInitial;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  // Cents back to a plain decimal for the input; the action re-parses it.
  const price =
    initial?.priceCents != null ? String(initial.priceCents / 100) : '';

  return (
    <form action={formAction} className={styles.form} noValidate>
      <Field
        id="name"
        name="name"
        label="Qu'est-ce qui vous ferait plaisir ?"
        defaultValue={initial?.name}
        placeholder="AirPods Pro, un vase en grès, un week-end…"
        required
        autoFocus={!initial}
        error={state.errors?.name}
      />

      <Field
        id="url"
        name="url"
        label="Lien"
        type="url"
        inputMode="url"
        defaultValue={initial?.url ?? ''}
        placeholder="Facultatif — la boutique sera devinée"
        error={state.errors?.url}
      />

      <div className={styles.row}>
        <Field
          id="price"
          name="price"
          label="Prix"
          inputMode="decimal"
          defaultValue={price}
          placeholder="Facultatif"
          error={state.errors?.price}
        />
        <Field
          id="category"
          name="category"
          label="Catégorie"
          defaultValue={initial?.category ?? ''}
          placeholder="Tech, Maison…"
          error={state.errors?.category}
        />
      </div>

      <ImageUpload
        name="image"
        label="Photo"
        initialUrl={initial?.imageUrl}
        serverError={state.errors?.image}
      />

      <TextareaField
        id="description"
        name="description"
        label="Précisions"
        defaultValue={initial?.description ?? ''}
        placeholder="Taille, couleur, modèle exact…"
        error={state.errors?.description}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>À quel point en avez-vous envie ?</legend>
        <div className={styles.priority}>
          {PRIORITIES.map((p) => (
            <label key={p.value} className={styles.priorityOption}>
              <input
                type="radio"
                name="priority"
                value={p.value}
                defaultChecked={(initial?.priority ?? 2) === p.value}
              />
              <span className={styles.priorityBars} aria-hidden>
                <span data-on={p.value >= 1 ? '' : undefined} />
                <span data-on={p.value >= 2 ? '' : undefined} />
                <span data-on={p.value >= 3 ? '' : undefined} />
              </span>
              <span className={styles.priorityText}>{p.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className={styles.checkbox}>
        <input type="checkbox" name="isPot" defaultChecked={initial?.isPot} />
        <span>
          <span className={styles.radioLabel}>Cadeau à plusieurs</span>
          <span className={styles.radioHint}>
            Vos proches pourront se regrouper et participer chacun à hauteur de
            ce qu&rsquo;ils veulent.
          </span>
        </span>
      </label>

      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
