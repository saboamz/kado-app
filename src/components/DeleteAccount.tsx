'use client';

import { deleteAccount } from '@/lib/profile-actions';
import { useT } from '@/lib/i18n/client';
import { Button } from './Button';

export function DeleteAccount() {
  const t = useT();
  return (
    <form
      action={deleteAccount}
      onSubmit={(e) => {
        if (
          !confirm(
            t('account.confirmDelete'),
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button variant="danger" type="submit">
        {t('settings.deleteAccount')}
      </Button>
    </form>
  );
}
