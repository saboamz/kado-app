'use client';

import { deleteList } from '@/lib/list-actions';
import { deleteGift } from '@/lib/gift-actions';
import { useT } from '@/lib/i18n/client';
import { Button } from './Button';

/**
 * Destructive actions confirm first.
 *
 * A native confirm() rather than a modal: it cannot be dismissed accidentally,
 * it works without JavaScript hydration subtleties, and deletion here cascades
 * to gifts and reservations.
 */
export function DeleteListButton({
  listId,
  listName,
}: {
  listId: string;
  listName: string;
}) {
  const t = useT();
  return (
    <form
      action={deleteList.bind(null, listId)}
      onSubmit={(e) => {
        if (
          !confirm(
            t('delete.listConfirm', { name: listName }),
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button variant="danger" type="submit">
        {t('delete.list')}
      </Button>
    </form>
  );
}

export function DeleteGiftButton({
  giftId,
  giftName,
}: {
  giftId: string;
  giftName: string;
}) {
  const t = useT();
  return (
    <form
      action={deleteGift.bind(null, giftId)}
      onSubmit={(e) => {
        if (!confirm(t('delete.giftConfirm', { name: giftName }))) {
          e.preventDefault();
        }
      }}
    >
      <Button variant="danger" type="submit">
        {t('delete.gift')}
      </Button>
    </form>
  );
}
