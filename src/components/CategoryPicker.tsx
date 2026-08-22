'use client';

import { categoryName } from '@/lib/i18n/categories';
import { useLocale } from '@/lib/i18n/client';
import { SURVEY_CATEGORIES } from '@/lib/taxonomy';
import styles from './survey.module.css';

/**
 * The one way to say what you like.
 *
 * Interests used to be a comma-separated line anybody could type into, and
 * that is what the closed category list exists to end: two people meaning the
 * same thing write "tech", "Tech" and "high-tech", and content_facet matches
 * on the value, so each spelling is a bucket nobody else falls into. Free
 * text belongs in the bio, which is prose nothing matches on.
 *
 * The stored value is the canonical French category — the same string
 * Product.categoryId holds — and only the label is translated.
 */
export function CategoryPicker({
  legend,
  hint,
  selected,
  name = 'interests',
}: {
  legend: string;
  hint?: string;
  /** Categories to tick on arrival. */
  selected?: readonly string[];
  name?: string;
}) {
  const locale = useLocale();
  const checked = new Set(selected ?? []);

  return (
    <fieldset className={styles.block}>
      <legend className={styles.legend}>{legend}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}

      <div className={styles.chips}>
        {SURVEY_CATEGORIES.map((category) => (
          <label key={category} className={styles.chip}>
            <input
              type="checkbox"
              name={name}
              value={category}
              defaultChecked={checked.has(category)}
            />
            <span>{categoryName(category, locale)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
