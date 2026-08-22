'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { saveSurvey, type SurveyState } from '@/lib/survey-actions';
import { useLocale, useT } from '@/lib/i18n/client';
import { categoryName } from '@/lib/i18n/categories';
import { SURVEY_CATEGORIES } from '@/lib/taxonomy';
import type { TFunction } from '@/lib/i18n/t';
import { SubmitButton } from './SubmitButton';
import styles from './survey.module.css';

/*
 * Built from the translator rather than declared as a module constant, for
 * the same reason ListForm does it: a constant is evaluated at import, before
 * any component has rendered and therefore before the locale is known.
 */
function genders(t: TFunction) {
  return [
    { value: 'FEMALE', label: t('survey.genderFemale') },
    { value: 'MALE', label: t('survey.genderMale') },
    { value: 'OTHER', label: t('survey.genderOther') },
  ];
}

/** Ranges rather than a date of birth — see the AgeBracket enum. */
const AGES = [
  { value: 'AGE_15_24', label: '15 – 24' },
  { value: 'AGE_25_34', label: '25 – 34' },
  { value: 'AGE_35_44', label: '35 – 44' },
  { value: 'AGE_45_54', label: '45 – 54' },
  { value: 'AGE_55_64', label: '55 – 64' },
  { value: 'AGE_65_PLUS', label: '65 +' },
];

export function SignupSurvey() {
  const t = useT();
  const locale = useLocale();
  const [state, action] = useActionState<SurveyState, FormData>(saveSurvey, {});

  return (
    <form action={action} className={styles.form}>
      <fieldset className={styles.block}>
        <legend className={styles.legend}>{t('survey.interestsTitle')}</legend>
        <p className={styles.hint}>{t('survey.interestsHint')}</p>

        {/* Checkboxes rather than free text: the value has to be one the
            recommender can match, and typing does not guarantee that.

            The stored value is the canonical French category — the same
            string Product.categoryId holds — and only the label is
            translated, exactly as the category dropdown does it. */}
        <div className={styles.chips}>
          {SURVEY_CATEGORIES.map((category) => (
            <label key={category} className={styles.chip}>
              <input type="checkbox" name="interests" value={category} />
              <span>{categoryName(category, locale)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.block}>
        <legend className={styles.legend}>{t('survey.aboutTitle')}</legend>
        <p className={styles.hint}>{t('survey.aboutHint')}</p>

        <p className={styles.question}>{t('survey.gender')}</p>
        <div className={styles.options}>
          {genders(t).map((option) => (
            <label key={option.value} className={styles.option}>
              <input type="radio" name="gender" value={option.value} />
              <span>{option.label}</span>
            </label>
          ))}
          {/* Not answering is an answer, and it is the default. It is stored
              as NULL: a refusal is not a category. */}
          <label className={styles.option}>
            <input type="radio" name="gender" value="" defaultChecked />
            <span>{t('survey.noAnswer')}</span>
          </label>
        </div>

        <p className={styles.question}>{t('survey.age')}</p>
        <div className={styles.options}>
          {AGES.map((option) => (
            <label key={option.value} className={styles.option}>
              <input type="radio" name="ageBracket" value={option.value} />
              <span>{option.label}</span>
            </label>
          ))}
          <label className={styles.option}>
            <input type="radio" name="ageBracket" value="" defaultChecked />
            <span>{t('survey.noAnswer')}</span>
          </label>
        </div>
      </fieldset>

      <p className={styles.privacy}>{t('survey.privacy')}</p>

      <div className={styles.actions}>
        <SubmitButton pendingLabel={t('survey.saving')} block={false}>
          {t('survey.submit')}
        </SubmitButton>
        {/* A real link, not a styled button: skipping must work whatever the
            form is doing, and must not be the thing that fails. */}
        <Link href="/app" className={styles.skip}>
          {t('survey.skip')}
        </Link>
      </div>

      {state.errors?.gender && <p role="alert">{state.errors.gender}</p>}
      {state.errors?.ageBracket && <p role="alert">{state.errors.ageBracket}</p>}
    </form>
  );
}
