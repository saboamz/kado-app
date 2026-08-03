'use client';

import { deleteList } from '@/lib/list-actions';
import { deleteGift } from '@/lib/gift-actions';
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
  return (
    <form
      action={deleteList.bind(null, listId)}
      onSubmit={(e) => {
        if (
          !confirm(
            `Supprimer la liste « ${listName} » et toutes ses envies ? Cette action est définitive.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button variant="danger" type="submit">
        Supprimer la liste
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
  return (
    <form
      action={deleteGift.bind(null, giftId)}
      onSubmit={(e) => {
        if (!confirm(`Supprimer « ${giftName} » de votre liste ?`)) {
          e.preventDefault();
        }
      }}
    >
      <Button variant="danger" type="submit">
        Supprimer cette envie
      </Button>
    </form>
  );
}
