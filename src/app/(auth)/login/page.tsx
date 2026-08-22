'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { login } from '@/lib/auth-actions';
import { useErrorText, useT } from '@/lib/i18n/client';
import { Field } from '@/components/Field';
import { SubmitButton } from '@/components/SubmitButton';
import styles from '../auth.module.css';

export default function LoginPage() {
  const t = useT();
  const errorText = useErrorText();
  const [state, action] = useActionState(login, {});
  const invite = useSearchParams().get('invite');

  return (
    <>
      <div>
        <h1 className={styles.title}>{t('auth.welcomeBack')}</h1>
        <p className={styles.subtitle}>
          Connectez-vous pour retrouver vos listes et celles de vos proches.
        </p>
      </div>

      <form action={action} className={styles.form} noValidate>
        {invite && <input type="hidden" name="invite" value={invite} />}
        {state.errors?.form && (
          <p className={styles.formError} role="alert">
            {/* A key, like every other action error — Field does this for
                the fields, and a form-level error has no Field to do it. */}
            {errorText(state.errors.form)}
          </p>
        )}
        <Field
          id="email"
          name="email"
          type="email"
          label={t('auth.email')}
          autoComplete="email"
          inputMode="email"
          required
          error={state.errors?.email}
        />
        <Field
          id="password"
          name="password"
          type="password"
          label={t('auth.password')}
          autoComplete="current-password"
          required
          error={state.errors?.password}
        />
        <SubmitButton pendingLabel={t('action.signingIn')}>{t('auth.signIn')}</SubmitButton>
      </form>

      <p className={styles.footer}>
        Pas encore de compte ? <Link href="/signup">{t('auth.createAccount')}</Link>
      </p>
    </>
  );
}
