/**
 * The getting-started checklist.
 *
 * ── Why nothing here is stored ─────────────────────────────────────────────
 *
 * The obvious build is four boolean columns set as each step is completed.
 * They would start lying almost immediately: delete the only wish and
 * `hasAddedWish` still says yes, so the checklist claims a step is done while
 * the page behind it is empty. A count queried at render time cannot drift
 * from what it counts, and a step that becomes undone correctly re-opens.
 *
 * The one thing that is stored is the dismissal — see User.onboardingDismissedAt
 * in the schema. 'Done' is a fact about the data; "I have seen this and do not
 * want it" is a decision, and nothing else in the database records it.
 *
 * ── Why signup does not seed this ──────────────────────────────────────────
 *
 * Signing up already creates a default list, which is why the home page's
 * 'Aucune liste' empty state never appears: a newcomer lands on a list that
 * exists and is empty, with nothing telling them what to do next. This card is
 * that missing prompt.
 */

import { db } from './db';
import type { TFunction } from './i18n/t';

export type OnboardingStepId = 'wish' | 'friend' | 'profile' | 'decoration';

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  body: string;
  /** Where the step is actually completed. */
  href: string;
  cta: string;
  done: boolean;
};

export type Onboarding = {
  steps: OnboardingStep[];
  /** How many are done, for the progress line. Never equals steps.length —
      a finished checklist is not returned at all. */
  doneCount: number;
};

/**
 * Reads the four steps from live data.
 *
 * Ordered by what unblocks the most: a list nobody can see is useless, and a
 * friend arriving at an empty list is worse than no friend at all — so the
 * wish comes first, then the person to show it to. Profile and decoration are
 * genuinely optional and sit at the end.
 *
 * Returns null when the checklist should not appear at all: dismissed, or
 * every step already done. The caller renders nothing rather than deciding.
 */
export async function getOnboarding(
  userId: string,
  t: TFunction,
): Promise<Onboarding | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { birthday: true, onboardingDismissedAt: true },
  });
  if (!user || user.onboardingDismissedAt) return null;

  const [giftCount, firstList, friendCount, interestCount, decorationCount] =
    await Promise.all([
      db.gift.count({ where: { list: { ownerId: userId } } }),
      // Straight to the form, not to the index. Signup creates a default list,
      // so there is almost always one to aim at; the index is the fallback for
      // the person who deleted it.
      db.giftList.findFirst({
        where: { ownerId: userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      }),
      db.friendship.count({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      db.interest.count({ where: { userId } }),
      db.profileDecoration.count({ where: { userId } }),
    ]);

  const steps: OnboardingStep[] = [
    {
      id: 'wish',
      title: t('onboarding.wishTitle'),
      body: t('onboarding.wishBody'),
      href: firstList ? `/lists/${firstList.id}/gifts/new` : '/lists',
      cta: t('onboarding.wishCta'),
      done: giftCount > 0,
    },
    {
      id: 'friend',
      title: t('onboarding.friendTitle'),
      body: t('onboarding.friendBody'),
      href: '/friends',
      cta: t('onboarding.friendCta'),
      done: friendCount > 0,
    },
    {
      id: 'profile',
      title: t('onboarding.profileTitle'),
      body: t('onboarding.profileBody'),
      href: '/profile/edit',
      cta: t('onboarding.profileCta'),
      // Deliberately not the avatar: a photo is a preference, while a birthday
      // and a few interests are what someone hunting for a present needs.
      done: Boolean(user.birthday) && interestCount > 0,
    },
    {
      id: 'decoration',
      title: t('onboarding.decorationTitle'),
      body: t('onboarding.decorationBody'),
      href: '/profile/edit',
      cta: t('onboarding.decorationCta'),
      done: decorationCount > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  // Finished checklists disappear on their own. Nothing to acknowledge, and a
  // card of four ticks is just clutter on the page it is meant to introduce.
  if (doneCount === steps.length) return null;

  return { steps, doneCount };
}
