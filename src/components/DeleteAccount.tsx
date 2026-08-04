'use client';

import { deleteAccount } from '@/lib/profile-actions';
import { Button } from './Button';

export function DeleteAccount() {
  return (
    <form
      action={deleteAccount}
      onSubmit={(e) => {
        if (
          !confirm(
            'Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.',
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button variant="danger" type="submit">
        Supprimer mon compte
      </Button>
    </form>
  );
}
