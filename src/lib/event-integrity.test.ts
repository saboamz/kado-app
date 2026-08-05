import { db } from './db';
import { logEvent } from './events';
import { cleanup, makeFriends, makeGift, makeList, makeUser } from '@/test/factories';

/**
 * Integrity of the event log against a hostile caller.
 *
 * Every test here describes a way somebody could manufacture signal — either
 * to push a product into everyone's recommendations, or to push a rival's out.
 * The model has no way to tell forged signal from real signal, so the log is
 * where it has to be stopped.
 */

describe('an event never outlives the thing it describes', () => {
  let actor: { id: string };
  let owner: { id: string };
  let giftId: string;

  beforeAll(async () => {
    actor = await makeUser('Actor');
    owner = await makeUser('Owner');
    const list = await makeList(owner.id);
    giftId = (await makeGift(list.id)).id;
  });

  afterEach(async () => {
    await db.giftEvent.deleteMany({ where: { actorId: actor.id } });
    await db.reservation.deleteMany({ where: { giftId } });
  });

  afterAll(async () => {
    await db.giftEvent.deleteMany({ where: { actorId: actor.id } });
    await cleanup([actor.id, owner.id]);
    await db.$disconnect();
  });

  it('rolls the event back when the reservation it describes fails', async () => {
    // The gift is already held, so the second create violates the unique index
    // on giftId. The event written alongside it must go with it: an event
    // describing a reservation that never happened trains the model on
    // something that did not occur, and is worse than no event at all.
    await db.reservation.create({ data: { giftId, reserverId: owner.id } });

    await expect(
      db.$transaction(async (tx) => {
        await tx.reservation.create({ data: { giftId, reserverId: actor.id } });
        await logEvent({ actorId: actor.id, kind: 'reserve', giftId }, tx);
      }),
    ).rejects.toThrow();

    expect(
      await db.giftEvent.count({ where: { actorId: actor.id, kind: 'reserve' } }),
    ).toBe(0);
  });

  it('proves that rollback assertion is not passing vacuously', async () => {
    // The assertion above is "0 events exist", which would pass just as well
    // if the event had never been attempted — the empty-absence trap. Running
    // the same transaction body WITHOUT the failing insert shows the event
    // really does get written, so the 0 above means rolled back, not absent.
    await db.$transaction(async (tx) => {
      await logEvent({ actorId: actor.id, kind: 'reserve', giftId }, tx);
    });
    expect(
      await db.giftEvent.count({ where: { actorId: actor.id, kind: 'reserve' } }),
    ).toBe(1);
  });

  it('commits the event and the reservation together when it succeeds', async () => {
    await db.$transaction(async (tx) => {
      await tx.reservation.create({ data: { giftId, reserverId: actor.id } });
      await logEvent({ actorId: actor.id, kind: 'reserve', giftId }, tx);
    });

    expect(await db.reservation.count({ where: { giftId } })).toBe(1);
    expect(
      await db.giftEvent.count({ where: { actorId: actor.id, kind: 'reserve' } }),
    ).toBe(1);
  });
});

/**
 * Forging negative signal.
 *
 * unreserve carries −3.0, which makes it the cheapest way to push a product
 * out of everybody's recommendations. If releasing a gift you never held wrote
 * an event, anyone could bury any product by looping release calls.
 */
describe('unreserve cannot be forged', () => {
  let owner: { id: string };
  let alice: { id: string };
  let mallory: { id: string };
  let giftId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    alice = await makeUser('Alice');
    mallory = await makeUser('Mallory');
    await makeFriends(owner.id, alice.id);
    await makeFriends(owner.id, mallory.id);
    const list = await makeList(owner.id);
    giftId = (await makeGift(list.id)).id;
  });

  afterEach(async () => {
    await db.reservation.deleteMany({ where: { giftId } });
    await db.giftEvent.deleteMany({
      where: { actorId: { in: [alice.id, mallory.id, owner.id] } },
    });
  });

  afterAll(async () => {
    await db.giftEvent.deleteMany({
      where: { actorId: { in: [alice.id, mallory.id, owner.id] } },
    });
    await cleanup([owner.id, alice.id, mallory.id]);
    await db.$disconnect();
  });

  /**
   * Replays the guard in releaseGift: delete scoped to the actor, and the
   * event written ONLY if a row actually went away, both in one transaction.
   * The server action itself needs a request context, so the rule it enforces
   * is exercised here directly.
   */
  const release = (actorId: string) =>
    db.$transaction(async (tx) => {
      const deleted = await tx.reservation.deleteMany({
        where: { giftId, reserverId: actorId },
      });
      if (deleted.count > 0) {
        await logEvent({ actorId, kind: 'unreserve', giftId }, tx);
      }
      return deleted.count;
    });

  it('writes no event when nothing was actually released', async () => {
    // Mallory releasing a gift she never reserved. unreserve carries -3.0, so
    // if this wrote a row she could push any product out of everyone's
    // recommendations just by looping this call.
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });

    expect(await release(mallory.id)).toBe(0);
    expect(
      await db.giftEvent.count({ where: { actorId: mallory.id, kind: 'unreserve' } }),
    ).toBe(0);
    // And Alice still holds it.
    expect(await db.reservation.count({ where: { giftId } })).toBe(1);
  });

  it('cannot be looped to bury a product', async () => {
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });

    for (let i = 0; i < 20; i++) await release(mallory.id);

    // Twenty attempts, zero forged evidence. Without the count check each one
    // would have written −3.0 against this product.
    expect(
      await db.giftEvent.count({ where: { actorId: mallory.id, kind: 'unreserve' } }),
    ).toBe(0);
  });

  it('writes exactly one event when something really was released', async () => {
    // The other half of the pair, and what stops the zeroes above from being
    // vacuous: it proves an unreserve event CAN be written here, so those
    // zeroes mean "refused" rather than "impossible".
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });

    expect(await release(alice.id)).toBe(1);
    expect(
      await db.giftEvent.count({ where: { actorId: alice.id, kind: 'unreserve' } }),
    ).toBe(1);
  });

  it('records the release as negative evidence, not as neutral', async () => {
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });
    await release(alice.id);

    const event = await db.giftEvent.findFirst({
      where: { actorId: alice.id, kind: 'unreserve' },
    });
    // Zero would only mean "no evidence". A reversal is evidence AGAINST.
    expect(event!.weight).toBeLessThan(0);
  });

  it('does not let one person release another persons reservation', async () => {
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });

    expect(await release(mallory.id)).toBe(0);
    // Alice keeps her reservation and Mallory produced no signal.
    expect(await db.reservation.count({ where: { giftId } })).toBe(1);
    expect(
      await db.giftEvent.count({ where: { actorId: mallory.id, kind: 'unreserve' } }),
    ).toBe(0);
  });
});

/**
 * The actor is the session, never the payload.
 *
 * If a caller could name the actor, one account could attribute purchases to a
 * thousand others and the co-occurrence matrix would be theirs to write.
 */
describe('the client entry point', () => {
  const source = () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('node:fs').readFileSync('src/lib/event-actions.ts', 'utf8') as string;

  it('exposes no way for a caller to choose its own actorId or weight', () => {
    // Structural rather than behavioural: the input type has no field for
    // either, so there is nowhere to put the request. A test that called it
    // with a forged id would not compile, which is the stronger guarantee —
    // but the schema is what a future edit would widen, so it is asserted.
    const text = source();
    const start = text.indexOf('const TelemetrySchema');
    const schema = text.slice(start, text.indexOf('});', start));

    expect(start).toBeGreaterThan(-1); // the slice actually found the schema
    expect(schema.length).toBeGreaterThan(50);
    expect(schema).not.toContain('actorId');
    expect(schema).not.toContain('weight');

    // And the actor is taken from the session user instead.
    expect(text).toContain('actorId: user.id');
  });

  it('parses the kind against the whitelist rather than a hand-written check', () => {
    // z.enum(CLIENT_LOGGABLE) means an unlisted kind is refused by parsing.
    // A hand-rolled if-statement is the thing somebody forgets to update.
    expect(source()).toContain('z.enum(CLIENT_LOGGABLE)');
  });
});
