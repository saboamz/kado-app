import { db } from './db';
import { cleanup, makeFriends, makeGift, makeList, makeUser } from '@/test/factories';

/**
 * Reporting a profile or a wish.
 *
 * ── What must hold ─────────────────────────────────────────────────────────
 *
 * The person reported learns nothing. Somebody who reports a photo on the
 * profile of a person they know socially has to be able to do it without that
 * person finding out — otherwise the only people who report are the ones
 * willing to have the conversation, and they are not the ones who need this.
 *
 * The actions call requireUser(), so the signed-in paths belong to the e2e
 * suite. What is pinned here is the shape of the record and the constraint
 * that keeps the table honest.
 */
let reporter: { id: string };
let subject: { id: string };
let giftId: string;

beforeAll(async () => {
  reporter = await makeUser('Celle qui signale');
  subject = await makeUser('Celui qui est signalé');
  await makeFriends(reporter.id, subject.id);

  const list = await makeList(subject.id);
  const gift = await makeGift(list.id);
  giftId = gift.id;
});

afterAll(async () => {
  await cleanup([reporter.id, subject.id]);
  await db.$disconnect();
});

describe('a report', () => {
  it('records what was reported, by whom, and why', async () => {
    const report = await db.report.create({
      data: {
        reporterId: reporter.id,
        subjectId: subject.id,
        reason: 'Photo de profil inappropriée',
      },
    });

    expect(report.handledAt).toBeNull();
    expect(report.reason).toBe('Photo de profil inappropriée');
  });

  it('refuses a second one about the same person', async () => {
    /*
     * A repeat is noise, not a signal. Without this, one angry evening fills
     * the queue and drowns the reports worth reading.
     *
     * The action turns this rejection into a success for the reporter: they
     * did what they meant to, and the first report is already waiting.
     */
    await expect(
      db.report.create({
        data: { reporterId: reporter.id, subjectId: subject.id, reason: 'Encore' },
      }),
    ).rejects.toThrow();
  });

  it('lets a different person report the same profile', async () => {
    // Two people reporting one profile is exactly the pattern worth seeing.
    const other = await makeUser('Un autre témoin');
    const second = await db.report.create({
      data: { reporterId: other.id, subjectId: subject.id, reason: 'Idem' },
    });

    expect(second.subjectId).toBe(subject.id);
    const about = await db.report.count({ where: { subjectId: subject.id } });
    expect(about).toBe(2);

    await cleanup([other.id]);
  });

  it('is invisible to the person reported', async () => {
    /*
     * Nothing about a report reaches its subject: no notification row, no
     * counter, nothing on their profile. Checked against the notification
     * table, because that is the only channel the app has for telling
     * somebody something.
     */
    const notifications = await db.notification.count({
      where: { userId: subject.id },
    });
    expect(notifications).toBe(0);
  });

  it('carries a wish instead of a profile when that is what was reported', async () => {
    const report = await db.report.create({
      data: { reporterId: reporter.id, giftId, reason: 'Image choquante' },
    });

    expect(report.giftId).toBe(giftId);
    expect(report.subjectId).toBeNull();
  });

  it('goes away with the person who made it', async () => {
    // A departing account takes its reports with it: they are its data too,
    // and the right to erasure does not stop at the interesting rows.
    const leaver = await makeUser('Partant');
    await db.report.create({
      data: { reporterId: leaver.id, subjectId: subject.id, reason: 'Test' },
    });

    await db.user.delete({ where: { id: leaver.id } });

    const left = await db.report.count({ where: { reporterId: leaver.id } });
    expect(left).toBe(0);
  });
});
