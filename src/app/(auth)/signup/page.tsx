'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { signup } from '@/lib/auth-actions';
import { Field } from '@/components/Field';
import { SubmitButton } from '@/components/SubmitButton';
import styles from '../auth.module.css';

export default function SignupPage() {
  const [state, action] = useActionState(signup, {});
  // Carried from an invitation link. A hidden field rather than a cookie:
  // the value only has to survive this one form post, and a cookie would
  // outlive the visit and befriend them on some later sign-up.
  const invite = useSearchParams().get('invite');

  return (
    <>
      <div>
        <h1 className={styles.title}>Créez votre compte.</h1>
        <p className={styles.subtitle}>
          Vos listes, vos amis, et des surprises qui le restent vraiment.
        </p>
      </div>

      <form action={action} className={styles.form} noValidate>
        {invite && <input type="hidden" name="invite" value={invite} />}
        {state.errors?.form && (
          <p className={styles.formError} role="alert">
            {state.errors.form}
          </p>
        )}
        <Field
          id="name"
          name="name"
          label="Nom"
          autoComplete="name"
          required
          error={state.errors?.name}
        />
        <Field
          id="email"
          name="email"
          type="email"
          label="Adresse e-mail"
          autoComplete="email"
          inputMode="email"
          required
          error={state.errors?.email}
        />
        <Field
          id="password"
          name="password"
          type="password"
          label="Mot de passe"
          autoComplete="new-password"
          required
          hint="Au moins 8 caractères."
          error={state.errors?.password}
        />
        <SubmitButton pendingLabel="Création…">Créer mon compte</SubmitButton>
      </form>

      <p className={styles.footer}>
        Vous avez déjà un compte ? <Link href="/login">Se connecter</Link>
      </p>
    </>
  );
}
