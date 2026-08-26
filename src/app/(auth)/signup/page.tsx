'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { signup } from '@/lib/auth-actions';
import { useErrorText, useT } from '@/lib/i18n/client';
import { Field } from '@/components/Field';
import { SubmitButton } from '@/components/SubmitButton';
import styles from '../auth.module.css';

export default function SignupPage() {
  const t = useT();
  const errorText = useErrorText();
  const [state, action] = useActionState(signup, {});
  // Carried from an invitation link. A hidden field rather than a cookie:
  // the value only has to survive this one form post, and a cookie would
  // outlive the visit and befriend them on some later sign-up.
  const invite = useSearchParams().get('invite');

  return (
    <>
      <div>
        <h1 className={styles.title}>{t('auth.createYours')}</h1>
        <p className={styles.subtitle}>
          {t('auth.signupLede')}
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
          id="name"
          name="name"
          label={t('auth.name')}
        hint={t('auth.nameHint')}
          autoComplete="name"
          required
          error={state.errors?.name}
        />
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
          autoComplete="new-password"
          required
          hint={t('auth.passwordHint')}
          error={state.errors?.password}
        />
        <SubmitButton pendingLabel={t('action.creating')}>{t('auth.signUp')}</SubmitButton>
      </form>

      <p className={styles.footer}>
        Vous avez déjà un compte ? <Link href="/login">{t('auth.signIn')}</Link>
      </p>
    </>
  );
}
