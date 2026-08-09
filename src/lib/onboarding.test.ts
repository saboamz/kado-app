import { db } from './db';
import { fr } from './i18n/fr';
import { translator } from './i18n/t';
import { getOnboarding } from './onboarding';
import {
  cleanup,
  makeFriends,
  makeGift,
  makeList,
  makeUser,
} from '@/test/factories';

/**
 * What the getting-started checklist says, and when it says nothing.
 *
 * The interesting cases are all about the choice NOT to store four booleans:
 * a step must be able to come undone, and the whole card must disappear on
 * its own. Neither is testable against stored flags, because a flag would
 * pass every one of these while lying.
 */
const users: string[] = [];

/*
 * A real translator, not a stub returning the key.
 *
 * The steps carry text a person reads, so the assertions below stay about
 * structure — which step, where it points, whether it is done — and never
 * about the French wording, which now lives in the dictionary and is free to
 * change without breaking this file.
 */
const t = translator('fr', fr);

/**
 * The checklist for somebody, asserted to exist.
 *
 * Every case below is about a card that IS shown; the two that expect no card
 * call getOnboarding directly. This keeps the assertions about steps rather
 * than about null-checking.
 */
const stepsFor = async (userId: string) => {
  const onboarding = await getOnboarding(userId, t);
  if (!onboarding) throw new Error('expected a checklist');
  return onboarding.steps;
};

const newcomer = async () => {
  const user = await makeUser('Nouvelle Venue');
  users.push(user.id);
  return user;
};

afterAll(async () => {
  await cleanup(users);
  await db.$disconnect();
});

describe('the getting-started checklist', () => {
  it('opens with everything still to do', async () => {
    const user = await newcomer();

    const onboarding = await getOnboarding(user.id, t);

    expect(onboarding).not.toBeNull();
    expect(onboarding!.doneCount).toBe(0);
    expect(onboarding!.steps.map((s) => s.id)).toEqual([
      'wish',
      'friend',
      'profile',
      'decoration',
    ]);
  });

  it('sends the first step to a form, not to an index', async () => {
    // Signup makes a default list, so 'add a wish' can land on the form
    // itself. Going via /lists costs a click on the one step that matters
    // most, at the moment somebody is least invested.
    const user = await newcomer();
    const list = await makeList(user.id);

    const onboarding = await getOnboarding(user.id, t);

    expect(onboarding!.steps[0]!.href).toBe(`/lists/${list.id}/gifts/new`);
  });

  it('falls back to the index when there is no list to aim at', async () => {
    const user = await newcomer();

    const onboarding = await getOnboarding(user.id, t);

    expect(onboarding!.steps[0]!.href).toBe('/lists');
  });

  it('points the friends step at the invitation link, not at search', async () => {
    // Search finds nobody on an app this size. The invite link is the only
    // route that actually produces a friend.
    const user = await newcomer();

    const onboarding = await getOnboarding(user.id, t);

    expect(onboarding!.steps[1]!.href).toBe('/friends');
  });

  it('ticks a step off once the data behind it exists', async () => {
    const user = await newcomer();
    const list = await makeList(user.id);
    await makeGift(list.id);

    const onboarding = await getOnboarding(user.id, t);

    expect(onboarding!.steps[0]!.done).toBe(true);
    expect(onboarding!.doneCount).toBe(1);
  });

  it('re-opens a step when its data goes away', async () => {
    // The whole reason nothing is stored. A `hasAddedWish` column would still
    // read true here, so the card would claim a step was done while the list
    // behind it sat empty.
    const user = await newcomer();
    const list = await makeList(user.id);
    const gift = await makeGift(list.id);

    expect((await stepsFor(user.id))[0]!.done).toBe(true);

    await db.gift.delete({ where: { id: gift.id } });

    expect((await stepsFor(user.id))[0]!.done).toBe(false);
  });

  it('counts a friendship from either side of it', async () => {
    // Friendship is stored directionally, one row with a requester and an
    // addressee. Counting only sentRequests would leave the person who
    // ACCEPTED an invitation staring at an unticked step.
    const inviter = await newcomer();
    const accepter = await newcomer();
    await makeFriends(inviter.id, accepter.id);

    expect((await stepsFor(inviter.id))[1]!.done).toBe(true);
    expect((await stepsFor(accepter.id))[1]!.done).toBe(true);
  });

  it('does not count a request nobody has accepted yet', async () => {
    const user = await newcomer();
    const other = await newcomer();
    await db.friendship.create({
      data: { requesterId: user.id, addresseeId: other.id, status: 'PENDING' },
    });

    expect((await stepsFor(user.id))[1]!.done).toBe(false);
  });

  it('wants a birthday AND an interest before the profile counts as done', async () => {
    // Both, because both are what somebody hunting for a present reads. A
    // birthday alone tells them when, not what.
    const user = await newcomer();
    await db.user.update({
      where: { id: user.id },
      data: { birthday: new Date('1990-05-04') },
    });

    expect((await stepsFor(user.id))[2]!.done).toBe(false);

    await db.interest.create({ data: { userId: user.id, label: 'Vélo' } });

    expect((await stepsFor(user.id))[2]!.done).toBe(true);
  });

  it('disappears once every step is done', async () => {
    const user = await newcomer();
    const list = await makeList(user.id);
    const friend = await newcomer();

    await makeGift(list.id);
    await makeFriends(user.id, friend.id);
    await db.user.update({
      where: { id: user.id },
      data: { birthday: new Date('1988-01-01') },
    });
    await db.interest.create({ data: { userId: user.id, label: 'Cuisine' } });
    await db.profileDecoration.create({
      data: {
        userId: user.id,
        slot: 'footer',
        gifUrl: 'https://media.giphy.com/a.gif',
        stillUrl: 'https://media.giphy.com/a.gif',
        width: 200,
        height: 200,
      },
    });

    expect(await getOnboarding(user.id, t)).toBeNull();
  });

  it('stays hidden once dismissed, even with steps left', async () => {
    const user = await newcomer();
    await db.user.update({
      where: { id: user.id },
      data: { onboardingDismissedAt: new Date() },
    });

    expect(await getOnboarding(user.id, t)).toBeNull();
  });
});
