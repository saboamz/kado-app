'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/gift-actions';
import { priorityLabel } from '@/lib/format';
import type { TFunction } from '@/lib/i18n/t';
import { categoryName } from '@/lib/i18n/categories';
import { CATEGORIES } from '@/lib/taxonomy';
import { useLocale, useT } from '@/lib/i18n/client';
import { Field, SelectField, TextareaField } from './Field';
import { ImageUpload } from './ImageUpload';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

// Derived from the one label table, so the wording a person picks here is
// literally the wording shown back to them on the gift. They used to be two
// separate lists that had already drifted: level 2 read "J'en ai envie" in
// this form and "J'en ai vraiment envie" everywhere else.
function priorities(t: TFunction) {
  return [3, 2, 1].map((value) => ({
    value,
    label: priorityLabel(value, t),
  }));
}

export type GiftInitial = {
  name: string;
  description: string | null;
  priceCents: number | null;
  url: string | null;
  merchant: string | null;
  category: string | null;
  priority: number;
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
  const t = useT();
  const locale = useLocale();
  const [state, formAction] = useActionState(action, {});
  // Cents back to a plain decimal for the input; the action re-parses it.
  const price =
    initial?.priceCents != null ? String(initial.priceCents / 100) : '';

  return (
    <form action={formAction} className={styles.form} noValidate>
      <Field
        id="name"
        name="name"
        label={t('form.giftName')}
        defaultValue={initial?.name}
        placeholder={t('form.giftNamePlaceholder')}
        required
        autoFocus={!initial}
        error={state.errors?.name}
      />

      <Field
        id="url"
        name="url"
        label={t('form.link')}
        type="url"
        inputMode="url"
        defaultValue={initial?.url ?? ''}
        placeholder={t('form.linkPlaceholder')}
        hint={t('form.linkHint')}
        error={state.errors?.url}
      />

      <div className={styles.row}>
        <Field
          id="price"
          name="price"
          label={t('form.price')}
          inputMode="decimal"
          defaultValue={price}
          placeholder={t('form.optional')}
          error={state.errors?.price}
        />
        <SelectField
          id="category"
          name="category"
          label={t('form.category')}
          defaultValue={initial?.category ?? ''}
          /* Values stay French — they are what the database stores and what
             the recommender joins on. Only the labels follow the reader. */
          options={CATEGORIES.map((value) => ({
            value,
            label: categoryName(value, locale),
          }))}
          placeholder={t('form.choose')}
          error={state.errors?.category}
        />
      </div>

      <ImageUpload
        name="image"
        label={t('form.photo')}
        initialUrl={initial?.imageUrl}
        serverError={state.errors?.image}
      />

      <TextareaField
        id="description"
        name="description"
        label={t('form.details')}
        defaultValue={initial?.description ?? ''}
        placeholder={t('form.detailsPlaceholder')}
        error={state.errors?.description}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('form.howMuch')}</legend>
        <div className={styles.priority}>
          {priorities(t).map((p) => (
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

      {/*
        There is no "collaborative gift" checkbox any more. Whether one friend
        buys this alone or several club together is theirs to decide once they
        know the price and who else is interested — and the whole point of the
        app is that the person asking never finds out either way.
      */}

      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
