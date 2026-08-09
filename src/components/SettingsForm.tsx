'use client';

import { useActionState } from 'react';
import { updateSettings } from '@/lib/profile-actions';
import { useT } from '@/lib/i18n/client';
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/locales';
import type { TFunction } from '@/lib/i18n/t';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

/* Built from the translator: a module-level array is evaluated at import,
   before the locale is known, so it could only hold one language. */
function themes(t: TFunction) {
  return [
    { value: 'SYSTEM', label: t('settings.themeSystem') },
    { value: 'LIGHT', label: t('settings.themeLight') },
    { value: 'DARK', label: t('settings.themeDark') },
  ] as const;
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'] as const;

export function SettingsForm({
  initial,
}: {
  initial: {
    theme: 'LIGHT' | 'DARK' | 'SYSTEM';
    profilePublic: boolean;
    currency: string;
    locale: string;
  };
}) {
  const t = useT();
  const [state, action] = useActionState(updateSettings, {});

  return (
    <form action={action} className={styles.form} noValidate>
      <div className={styles.fieldset}>
        <label className={styles.legend} htmlFor="locale">
          {t('settings.language')}
        </label>
        <select
          id="locale"
          name="locale"
          className={styles.select}
          defaultValue={initial.locale}
        >
          {/* Each language is named in ITSELF — somebody who has landed in the
              wrong one has to be able to recognise their own. */}
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('form.appearance')}</legend>
        {themes(t).map((theme) => (
          <label key={theme.value} className={styles.radio}>
            <input
              type="radio"
              name="theme"
              value={theme.value}
              defaultChecked={initial.theme === theme.value}
            />
            <span>
              <span className={styles.radioLabel}>{theme.label}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('form.privacy')}</legend>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            name="profilePublic"
            defaultChecked={initial.profilePublic}
          />
          <span>
            <span className={styles.radioLabel}>{t('form.publicProfile')}</span>
            <span className={styles.radioHint}>
              {t('settings.publicProfileHint')}
            </span>
          </span>
        </label>
      </fieldset>

      <div className={styles.fieldset}>
        <label className={styles.legend} htmlFor="currency">
          {t('settings.currency')}
        </label>
        <select
          id="currency"
          name="currency"
          className={styles.select}
          defaultValue={initial.currency}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {state.saved && (
        <p className={styles.saved} role="status">
          {t('settings.saved')}
        </p>
      )}

      <SubmitButton pendingLabel={t('action.saving')}>{t('common.save')}</SubmitButton>
    </form>
  );
}
