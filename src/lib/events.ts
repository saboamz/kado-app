import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from './db';

/**
 * The event log: what someone did, and how much it counts as evidence.
 *
 * Two rules hold this together, and both are security properties rather than
 * modelling choices:
 *
 *  1. The weight is resolved HERE, from the kind. A caller-supplied weight
 *     would let anyone declare their own click worth ten purchases.
 *  2. Only browsing kinds may be logged by a client. See CLIENT_LOGGABLE.
 */

export type EventKind =
  | 'purchase'
  | 'reserve'
  | 'contribute'
  | 'add_wish'
  | 'like_wish'
  | 'click_out'
  | 'view_wish'
  | 'view_product'
  | 'unreserve'
  | 'dismiss_reco';

/**
 * Confidences, not ratings.
 *
 * The number says how strongly the action evidences taste, which is why money
 * outranks everything and the negatives are genuinely negative: a reversal is
 * evidence AGAINST, not merely the absence of evidence for.
 */
export const WEIGHTS: Record<EventKind, number> = {
  purchase: 10.0, // money changed hands
  reserve: 6.0, // committed intent
  contribute: 5.0, // committed intent, shared
  /**
   * Evidence about the person who ADDED it, not about giving it to anyone.
   * Mixing these in with the gifts would train the model on the wrong axis:
   * "people who wanted X also wanted Y" is a different question from "people
   * who gave X also gave Y", and the CF matrix asks the second one.
   */
  add_wish: 3.0,
  like_wish: 1.5,
  click_out: 1.0,
  view_wish: 0.5, // noisy
  view_product: 0.3, // noisier
  unreserve: -3.0, // a reversal is proof against
  dismiss_reco: -2.0, // explicit negative
};

/**
 * THE WHITELIST. The security point of this phase.
 *
 * A client may only ever log navigation. If it could log a purchase, anyone
 * could push a product into every recommendation list by looping POSTs — and
 * the resulting model would be indistinguishable from a healthy one until
 * somebody eventually wondered why the same item kept winning.
 *
 * The kinds that carry real weight (purchase, reserve, contribute, unreserve)
 * are written server-side by the actions that perform them, inside the same
 * transaction as the thing they describe.
 */
export const CLIENT_LOGGABLE = [
  'view_product',
  'view_wish',
  'like_wish',
  'click_out',
  'dismiss_reco',
] as const satisfies readonly EventKind[];

export type ClientEventKind = (typeof CLIENT_LOGGABLE)[number];

const CLIENT_LOGGABLE_SET: ReadonlySet<string> = new Set(CLIENT_LOGGABLE);

export function isClientLoggable(kind: string): kind is ClientEventKind {
  return CLIENT_LOGGABLE_SET.has(kind);
}

/** A Prisma client or an interactive transaction handle. */
type Db = PrismaClient | Prisma.TransactionClient;

export type LogInput = {
  actorId: string;
  kind: EventKind;
  recipientId?: string | null;
  productId?: string | null;
  giftId?: string | null;
  categoryId?: string | null;
  /** The price AT THIS MOMENT. Never re-read from Product afterwards. */
  priceCents?: number | null;
  sessionId?: string | null;
  source?: string | null;
};

/**
 * Appends one event.
 *
 * `client` takes the transaction handle when the caller has one, so the event
 * and the thing it records commit or roll back together — an event describing
 * a reservation that failed is worse than no event at all.
 */
export async function logEvent(input: LogInput, client: Db = db) {
  return client.giftEvent.create({
    data: {
      actorId: input.actorId,
      kind: input.kind,
      recipientId: input.recipientId ?? null,
      productId: input.productId ?? null,
      giftId: input.giftId ?? null,
      categoryId: input.categoryId ?? null,
      priceCents: input.priceCents ?? null,
      // Resolved here, never taken from the caller.
      weight: WEIGHTS[input.kind],
      sessionId: input.sessionId ?? null,
      source: input.source ?? null,
    },
  });
}

/**
 * Appends a browsing event, swallowing every failure.
 *
 * Telemetry must never break a page: a lost row is worth less than a broken
 * screen. The once-per-session cap is a partial unique index, so a repeat view
 * arrives here as a constraint violation and is dropped on purpose.
 */
export async function logClientEvent(
  input: LogInput & { kind: ClientEventKind },
): Promise<void> {
  try {
    await logEvent(input);
  } catch {
    // Deliberately silent. See above.
  }
}
