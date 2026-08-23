'use client';

import { useActionState, useRef, useState } from 'react';
import { previewProduct } from '@/lib/catalogue-actions';
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

  /*
   * Reading the pasted page, while the person is still on the form.
   *
   * The extraction machinery always ran — but only AFTER the save, feeding
   * the catalogue, while the person typed the name and price by hand off a
   * page we were about to read anyway. The hint even promised otherwise.
   * This calls the same server action the moment a link is pasted or the
   * field is left, and fills what it learned.
   *
   * Only EMPTY fields are written. What somebody typed is theirs: a page's
   * og:title never overwrites a name a person chose, however bad theirs is.
   */
  const [reading, setReading] = useState<'idle' | 'reading' | 'filled' | 'failed'>('idle');
  const [readingError, setReadingError] = useState<string | null>(null);
  /*
   * The catalogue's stored copy of the page's picture, offered rather than
   * imposed: it sits beside the photo field with a way to refuse it, and the
   * form only sends a FLAG saying it was left in place. The server re-reads
   * the path from the product row it resolves itself — nothing client-sent
   * ever names a file.
   */
  const [suggestedImage, setSuggestedImage] = useState<string | null>(null);
  // Seeded with the saved URL so reopening the edit form does not re-fetch a
  // page whose answers are already in the fields.
  const lastTried = useRef<string | null>(initial?.url ?? null);

  async function prefillFrom(raw: string, form: HTMLFormElement | null) {
    const url = raw.trim();
    if (!form || url === lastTried.current) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return; // not a URL yet — half-typed text is not worth a request
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;

    lastTried.current = url;
    setReading('reading');
    setReadingError(null);

    const result = await previewProduct(url);
    if (result.error) {
      setReadingError(result.error);
      setReading('failed');
      return;
    }
    if (!result.product) {
      setReading('failed');
      return;
    }

    let filled = false;
    const name = form.elements.namedItem('name');
    if (name instanceof HTMLInputElement && !name.value.trim()) {
      name.value = result.product.title;
      filled = true;
    }
    const priceField = form.elements.namedItem('price');
    if (
      priceField instanceof HTMLInputElement &&
      !priceField.value.trim() &&
      result.product.priceCents != null
    ) {
      priceField.value = String(result.product.priceCents / 100);
      filled = true;
    }
    // Précisions is left alone on purpose: it is the person's own field —
    // size, colour, the exact model — and a shop's marketing paragraph
    // pasted there reads as noise they then have to delete.
    // Offered only where there is room for it: a gift that already has its
    // own photo keeps it, without a competing thumbnail underneath.
    if (result.product.imagePath && !initial?.imageUrl) {
      setSuggestedImage(result.product.imagePath);
      filled = true;
    }
    // Every field already carried the person's own words: nothing was done,
    // so nothing is announced.
    setReading(filled ? 'filled' : 'idle');
  }

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
        // The paste IS the gesture: the preview starts before the field is
        // even left. currentTarget is read before the await — React frees the
        // event object once the handler returns.
        onPaste={(e) => prefillFrom(e.clipboardData.getData('text'), e.currentTarget.form)}
        onBlur={(e) => prefillFrom(e.currentTarget.value, e.currentTarget.form)}
        hint={
          reading === 'idle' ? (
            t('form.linkHint')
          ) : (
            <span role="status">
              {reading === 'reading'
                ? t('form.linkReading')
                : reading === 'filled'
                  ? t('form.linkFilled')
                  : (readingError ?? t('form.linkNothing'))}
            </span>
          )
        }
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

      {suggestedImage && (
        <div className={styles.suggestedImage}>
          <input type="hidden" name="imageFromPage" value="1" />
          {/* Our own stored copy, so the CSP has no objection. A picked file
              always wins over this on the server side. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={suggestedImage} alt="" className={styles.suggestedThumb} />
          <span className={styles.suggestedText}>{t('form.photoFound')}</span>
          <button
            type="button"
            className={styles.suggestedDismiss}
            onClick={() => setSuggestedImage(null)}
          >
            {t('form.photoFoundIgnore')}
          </button>
        </div>
      )}

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
