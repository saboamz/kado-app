'use server';

import { db } from './db';
import { canViewList, relationTo } from './relations';
import { rateLimit, recordAttempt, REPORT_PER_USER } from './rate-limit';
import { requireUser } from './session';

export type ReportResult = { error?: string; done?: boolean };

/**
 * Telling us that a profile or a wish is not acceptable.
 *
 * ── Why nothing reaches the person reported ────────────────────────────────
 *
 * A report produces no notification, no badge, no change anybody can see.
 * Somebody who reports a photo on the profile of a person they know socially
 * has to be able to do it without that person finding out — otherwise the
 * only people who report are the ones willing to have the conversation, and
 * they are not the ones who need this.
 *
 * It is also why the reporter's name is stored but never shown. The id exists
 * to refuse a second report of the same thing by the same person; nothing
 * reads it back to anyone.
 *
 * ── Why there is no automatic detection behind it ──────────────────────────
 *
 * Nothing looks at what an uploaded image contains. Automatic moderation is
 * either a paid API or a local model that adds seconds to every upload and
 * mistakes a beach holiday for something else. At this size a person looking
 * at the image is both cheaper and better. That stops being true at a scale
 * this app is nowhere near, and the table is here so the day it happens the
 * history already exists.
 */
export async function reportProfile(
  subjectId: string,
  reason: string,
): Promise<ReportResult> {
  const user = await requireUser();

  // Reporting yourself is not a thing, and a self-report would be a way to
  // put your own row in the queue.
  if (subjectId === user.id) return { error: 'error.cannotReportYourself' };

  const subject = await db.user.findUnique({
    where: { id: subjectId },
    select: { id: true },
  });
  if (!subject) return { error: 'error.personNotFound' };

  return save({ reporterId: user.id, subjectId, reason });
}

/**
 * The same, for a wish.
 *
 * Restricted to somebody who can already see it: a report is not a way to
 * reach into a list you have no access to, and an id you cannot view is one
 * you should not be able to name.
 */
export async function reportGift(
  giftId: string,
  reason: string,
): Promise<ReportResult> {
  const user = await requireUser();

  const gift = await db.gift.findUnique({
    where: { id: giftId },
    select: { id: true, list: { select: { ownerId: true, visibility: true } } },
  });
  if (!gift) return { error: 'error.giftNotFound' };

  const relation = await relationTo(user.id, gift.list.ownerId);
  if (!canViewList(gift.list.visibility, relation)) {
    return { error: 'error.giftNotFound' };
  }
  // Your own wish: there is nobody to protect from it.
  if (relation === 'owner') return { error: 'error.cannotReportYourself' };

  return save({ reporterId: user.id, giftId, reason });
}

/**
 * Writes the report, or quietly accepts a repeat.
 *
 * A second report of the same thing by the same person returns success rather
 * than an error: they did what they meant to, the first one is already in the
 * queue, and telling them off for caring twice serves nobody.
 */
async function save(data: {
  reporterId: string;
  subjectId?: string;
  giftId?: string;
  reason: string;
}): Promise<ReportResult> {
  const reason = data.reason.trim().slice(0, 500);

  /*
   * Both entry points come through here, so the ceiling lives here too.
   *
   * The unique index already refuses a second report of the same thing by the
   * same person; what it does not stop is one person reporting a hundred
   * different things in an evening, which is how the queue becomes useless to
   * whoever reads it.
   */
  const budget = await rateLimit('report', data.reporterId, REPORT_PER_USER);
  if (!budget.allowed) return { error: 'error.tooManyReports' };
  await recordAttempt('report', data.reporterId);

  try {
    await db.report.create({ data: { ...data, reason } });
  } catch {
    // Lost the unique index: already reported. Same outcome for them.
    return { done: true };
  }

  return { done: true };
}
