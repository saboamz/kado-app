'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireUser } from './session';

/**
 * Closes the getting-started checklist, for good.
 *
 * Stamped rather than flagged: a date says WHEN somebody decided they were
 * done being guided, which is the question worth asking later. A boolean only
 * says that they did.
 *
 * There is no undo, on purpose — the steps are all reachable from the nav, so
 * dismissing the card loses a shortcut, not a feature.
 */
export async function dismissOnboarding(): Promise<void> {
  const user = await requireUser();

  await db.user.update({
    where: { id: user.id },
    data: { onboardingDismissedAt: new Date() },
  });

  revalidatePath('/app');
}
