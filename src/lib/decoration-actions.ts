'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { isAllowedGifUrl, isSlot, type GifChoice } from './decorations';
import { searchGifs, type GiphyResult } from './giphy';
import { LINK_FETCH_PER_USER, rateLimit, recordAttempt } from './rate-limit';
import { requireUser } from './session';

export type DecorationResult = { error?: string };

/**
 * Searching for a GIF, on behalf of the signed-in person.
 *
 * A server action rather than a route so the API key stays server-side — a
 * key shipped to the browser is a public key, and anyone reading the network
 * tab can spend the quota.
 *
 * Budgeted with the same allowance as link resolution: both are our server
 * making outbound requests on somebody's behalf, and a search box is trivial
 * to hold down.
 */
export async function findGifs(query: string): Promise<GiphyResult> {
  const user = await requireUser();

  const budget = await rateLimit('gif:search', user.id, LINK_FETCH_PER_USER);
  if (!budget.allowed) return { ok: false, reason: 'failed' };
  await recordAttempt('gif:search', user.id);

  return searchGifs(query);
}

/**
 * Puts a GIF in one of the profile's slots.
 *
 * ── Why the choice is re-checked here ──────────────────────────────────────
 *
 * The picker posts back what the search gave it, and nothing stops a crafted
 * request posting something else entirely. Without the host allowlist, anyone
 * could point a profile at a server of their choosing and turn every visit
 * into a tracked hit — on a page whose whole premise is that people cannot
 * see what others are doing.
 */
export async function setDecoration(
  slot: string,
  choice: GifChoice,
): Promise<DecorationResult> {
  const user = await requireUser();

  if (!isSlot(slot)) return { error: 'error.unknownSlot' };
  if (!isAllowedGifUrl(choice.gifUrl) || !isAllowedGifUrl(choice.stillUrl)) {
    return { error: 'error.imageNotAllowed' };
  }

  const width = Math.round(Number(choice.width));
  const height = Math.round(Number(choice.height));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return { error: 'error.imageUnreadable' };
  }

  // Upsert on (userId, slot): choosing a second GIF for the same place
  // replaces the first rather than failing on the unique index.
  await db.profileDecoration.upsert({
    where: { userId_slot: { userId: user.id, slot } },
    create: {
      userId: user.id,
      slot,
      gifUrl: choice.gifUrl,
      stillUrl: choice.stillUrl,
      width,
      height,
      // Trimmed: a title is used as alt text, and Giphy's can be very long.
      title: choice.title?.slice(0, 120) ?? null,
    },
    update: {
      gifUrl: choice.gifUrl,
      stillUrl: choice.stillUrl,
      width,
      height,
      title: choice.title?.slice(0, 120) ?? null,
    },
  });

  revalidatePath(`/u/${user.id}`);
  revalidatePath('/profile');
  return {};
}

/** Empties one slot. Scoped to the caller: you can only clear your own. */
export async function clearDecoration(slot: string): Promise<DecorationResult> {
  const user = await requireUser();
  if (!isSlot(slot)) return { error: 'error.unknownSlot' };

  await db.profileDecoration.deleteMany({ where: { userId: user.id, slot } });

  revalidatePath(`/u/${user.id}`);
  revalidatePath('/profile');
  return {};
}
