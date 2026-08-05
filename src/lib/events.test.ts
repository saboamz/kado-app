import { db } from './db';
import {
  CLIENT_LOGGABLE,
  WEIGHTS,
  isClientLoggable,
  logClientEvent,
  logEvent,
  type EventKind,
} from './events';
import { cleanup, makeGift, makeList, makeUser } from '@/test/factories';

/**
 * The event log.
 *
 * The whitelist tests below are the security surface of this phase, not a
 * modelling detail: if a client could log a purchase, anyone could push a
 * product into every recommendation list by looping POSTs, and the resulting
 * model would look healthy right up until somebody wondered why the same item
 * always won.
 */

const ALL_KINDS: EventKind[] = [
  'purchase',
  'reserve',
  'contribute',
  'add_wish',
  'like_wish',
  'click_out',
  'view_wish',
  'view_product',
  'unreserve',
  'dismiss_reco',
];

describe('the client whitelist', () => {
  it('admits only browsing', () => {
    expect([...CLIENT_LOGGABLE].sort()).toEqual(
      ['click_out', 'dismiss_reco', 'like_wish', 'view_product', 'view_wish'].sort(),
    );
  });

  it.each(['purchase', 'reserve', 'contribute', 'unreserve', 'add_wish'] as const)(
    'refuses %s, which only the server may write',
    (kind) => {
      // These carry the weight the recommender actually learns from, so they
      // are written by the actions that perform them, in the same transaction,
      // from a session-derived actorId.
      expect(isClientLoggable(kind)).toBe(false);
    },
  );

  it('leaves no kind unclassified', () => {
    for (const kind of ALL_KINDS) {
      expect(typeof isClientLoggable(kind)).toBe('boolean');
    }
    expect(ALL_KINDS).toHaveLength(Object.keys(WEIGHTS).length);
  });

  it('would notice if the whitelist grew to admit a paid action', () => {
    // Guards the guard. The assertion above pins an exact list; this states
    // the invariant behind it, so widening the list to include something with
    // real weight fails here even if the first test were updated to match.
    for (const kind of CLIENT_LOGGABLE) {
      expect(WEIGHTS[kind]).toBeLessThanOrEqual(1.5);
    }
  });
});

describe('weights are confidences', () => {
  it('ranks money above intent above browsing', () => {
    expect(WEIGHTS.purchase).toBeGreaterThan(WEIGHTS.reserve);
    expect(WEIGHTS.reserve).toBeGreaterThan(WEIGHTS.contribute);
    expect(WEIGHTS.contribute).toBeGreaterThan(WEIGHTS.add_wish);
    expect(WEIGHTS.add_wish).toBeGreaterThan(WEIGHTS.like_wish);
    expect(WEIGHTS.like_wish).toBeGreaterThan(WEIGHTS.click_out);
    expect(WEIGHTS.click_out).toBeGreaterThan(WEIGHTS.view_wish);
    expect(WEIGHTS.view_wish).toBeGreaterThan(WEIGHTS.view_product);
  });

  it('makes reversals genuinely negative, not merely absent', () => {
    // Evidence AGAINST. Zero would only mean "no evidence", a weaker claim.
    expect(WEIGHTS.unreserve).toBeLessThan(0);
    expect(WEIGHTS.dismiss_reco).toBeLessThan(0);
  });

  it('keeps add_wish below the gifting kinds', () => {
    // add_wish is evidence about the ADDER and shares the log with events
    // about giving. If it outweighed them the model would learn the wrong axis.
    expect(WEIGHTS.add_wish).toBeLessThan(WEIGHTS.contribute);
  });
});

describe('writing events against the database', () => {
  let actor: { id: string };
  let recipient: { id: string };
  let giftId: string;

  beforeAll(async () => {
    actor = await makeUser('Actor');
    recipient = await makeUser('Recipient');
    const list = await makeList(recipient.id);
    giftId = (await makeGift(list.id)).id;
  });

  afterEach(async () => {
    await db.giftEvent.deleteMany({ where: { actorId: actor.id } });
  });

  afterAll(async () => {
    await db.giftEvent.deleteMany({ where: { actorId: actor.id } });
    await cleanup([actor.id, recipient.id]);
    await db.$disconnect();
  });

  it('resolves the weight from the kind, never from the caller', async () => {
    const event = await logEvent({
      actorId: actor.id,
      kind: 'purchase',
      recipientId: recipient.id,
      giftId,
    });
    // There is no weight parameter to pass.
    expect(event.weight).toBe(WEIGHTS.purchase);
  });

  it('stores the price as a fact about an instant', async () => {
    const event = await logEvent({
      actorId: actor.id,
      kind: 'reserve',
      giftId,
      priceCents: 4990,
    });
    expect(event.priceCents).toBe(4990);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('caps a repeated view at one per session', async () => {
    const view = {
      actorId: actor.id,
      kind: 'view_product' as const,
      productId: 'prod-abc',
      sessionId: 'sess-1',
    };
    await logClientEvent(view);
    await logClientEvent(view);
    await logClientEvent(view);

    expect(
      await db.giftEvent.count({
        where: { actorId: actor.id, kind: 'view_product', productId: 'prod-abc' },
      }),
    ).toBe(1);
  });

  it('counts the same product again in a NEW session', async () => {
    await logClientEvent({
      actorId: actor.id,
      kind: 'view_product',
      productId: 'prod-abc',
      sessionId: 'sess-1',
    });
    await logClientEvent({
      actorId: actor.id,
      kind: 'view_product',
      productId: 'prod-abc',
      sessionId: 'sess-2',
    });
    // Coming back another day is real repeat interest and must survive the
    // cap, or the cap would erase signal rather than noise.
    expect(
      await db.giftEvent.count({
        where: { actorId: actor.id, kind: 'view_product', productId: 'prod-abc' },
      }),
    ).toBe(2);
  });

  it('does NOT cap the kinds that can legitimately repeat', async () => {
    // Someone really can reserve a product, release it, and reserve it again.
    // A blanket unique index would swallow the second one silently.
    for (let i = 0; i < 3; i++) {
      await logEvent({
        actorId: actor.id,
        kind: 'reserve',
        productId: 'prod-repeat',
        sessionId: 'sess-1',
      });
    }
    expect(
      await db.giftEvent.count({ where: { actorId: actor.id, kind: 'reserve' } }),
    ).toBe(3);
  });

  it('never breaks a page when telemetry fails', async () => {
    // A lost row is worth less than a broken screen.
    const view = {
      actorId: actor.id,
      kind: 'view_product' as const,
      productId: 'prod-dup',
      sessionId: 'sess-x',
    };
    await logClientEvent(view);
    await expect(logClientEvent(view)).resolves.toBeUndefined();
  });
});
