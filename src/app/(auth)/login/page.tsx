'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { login } from '@/lib/auth-actions';
import { Field } from '@/components/Field';
import { SubmitButton } from '@/components/SubmitButton';
import styles from '../auth.module.css';

export default function LoginPage() {
  const [state, action] = useActionState(login, {});
  const invite = useSearchParams().get('invite');

  return (
    <>
      <div>
        <h1 className={styles.title}>Content de vous revoir.</h1>
        <p className={styles.subtitle}>
          Connectez-vous pour retrouver vos listes et celles de vos proches.
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
          autoComplete="current-password"
          required
          error={state.errors?.password}
        />
        <SubmitButton pendingLabel="Connexion…">Se connecter</SubmitButton>
      </form>

      <p className={styles.footer}>
        Pas encore de compte ? <Link href="/signup">Créer un compte</Link>
      </p>

      <p className={styles.demo}>
        Compte de démonstration : <code>sophie@kado.app</code> — mot de passe{' '}
        <code>kado1234</code>. Essayez aussi <code>thomas@kado.app</code>, qui a
        réservé un cadeau de Sophie.
      </p>
    </>
  );
}
