'use client';

import { useActionState } from 'react';
import { updateSettings } from '@/lib/profile-actions';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

const THEMES = [
  { value: 'SYSTEM', label: 'Comme mon appareil' },
  { value: 'LIGHT', label: 'Clair' },
  { value: 'DARK', label: 'Sombre' },
] as const;

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'] as const;

export function SettingsForm({
  initial,
}: {
  initial: {
    theme: 'LIGHT' | 'DARK' | 'SYSTEM';
    profilePublic: boolean;
    currency: string;
  };
}) {
  const [state, action] = useActionState(updateSettings, {});

  return (
    <form action={action} className={styles.form} noValidate>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Apparence</legend>
        {THEMES.map((theme) => (
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
        <legend className={styles.legend}>Confidentialité</legend>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            name="profilePublic"
            defaultChecked={initial.profilePublic}
          />
          <span>
            <span className={styles.radioLabel}>Profil public</span>
            <span className={styles.radioHint}>
              Toute personne ayant le lien peut voir votre profil et vos listes
              publiques. Vos réservations restent privées quoi qu&rsquo;il
              arrive.
            </span>
          </span>
        </label>
      </fieldset>

      <div className={styles.fieldset}>
        <label className={styles.legend} htmlFor="currency">
          Devise
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
          Vos préférences ont été enregistrées.
        </p>
      )}

      <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
    </form>
  );
}
