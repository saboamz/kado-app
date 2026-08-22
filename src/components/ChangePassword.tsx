'use client';

import { useActionState } from 'react';
import { changePassword, type FormState } from '@/lib/auth-actions';
import { useT } from '@/lib/i18n/client';
import { Field } from './Field';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

/**
 * Changing a password from inside the account.
 *
 * The only remedy the product offered somebody who thought their password was
 * known was deleting the account. A reset flow needs e-mail and does not exist
 * yet; this is the half that needs nothing.
 */
export function ChangePassword() {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});

  return (
    <form action={action} className={styles.form}>
      <Field
        id="current"
        name="current"
        type="password"
        autoComplete="current-password"
        label={t('password.current')}
        error={state.errors?.current}
        required
      />

      <Field
        id="next"
        name="next"
        type="password"
        autoComplete="new-password"
        label={t('password.next')}
        hint={t('auth.passwordHint')}
        error={state.errors?.next}
        required
      />

      <SubmitButton pendingLabel={t('password.saving')} block={false}>
        {t('password.save')}
      </SubmitButton>

      {/* Announced, not just shown: the form stays put on success, so without
          this a screen reader has no way to know anything happened. */}
      {state.done && (
        <p role="status" className={styles.saved}>
          {t('password.done')}
        </p>
      )}
    </form>
  );
}
