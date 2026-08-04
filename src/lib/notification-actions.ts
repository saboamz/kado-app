'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireUser } from './session';

/** Clears the unread badge. Scoped to the signed-in user's own rows. */
export async function markAllRead(): Promise<void> {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath('/notifications');
  revalidatePath('/app');
}
