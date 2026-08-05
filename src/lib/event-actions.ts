'use server';

import { z } from 'zod';
import {
  CLIENT_LOGGABLE,
  isClientLoggable,
  logClientEvent,
  type ClientEventKind,
} from './events';
import { getCurrentUser } from './session';

/**
 * The one entry point a browser has into the event log.
 *
 * Everything a client can express is constrained here: which kinds it may log
 * at all, and whose id the row is attributed to. The actorId is taken from the
 * session and the parameter for it does not exist — a caller cannot ask for a
 * row to be written as somebody else, because there is nowhere to put the
 * request.
 */

const TelemetrySchema = z.object({
  // z.enum over the whitelist, so an unlisted kind is rejected by parsing
  // rather than by a check somebody could forget to write.
  kind: z.enum(CLIENT_LOGGABLE),
  productId: z.string().min(1).max(64).nullish(),
  giftId: z.string().min(1).max(64).nullish(),
  sessionId: z.string().min(1).max(64).nullish(),
  source: z.string().max(64).nullish(),
});

export type TelemetryInput = {
  kind: ClientEventKind;
  productId?: string | null;
  giftId?: string | null;
  sessionId?: string | null;
  source?: string | null;
};

/**
 * Records a browsing event. Returns nothing, and fails silently by design.
 *
 * There is no priceCents or weight parameter: the weight is resolved from the
 * kind server-side, and a price is only a fact when the server observed it.
 */
export async function recordTelemetry(input: TelemetryInput): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return; // anonymous browsing is not attributed to anyone

  const parsed = TelemetrySchema.safeParse(input);
  if (!parsed.success) return;

  // Belt and braces: the schema already refuses anything unlisted, but this is
  // the invariant the whole phase rests on, so it is asserted twice rather
  // than trusted to one z.enum somebody might later widen.
  if (!isClientLoggable(parsed.data.kind)) return;

  await logClientEvent({
    ...parsed.data,
    // From the session. Not a parameter, and never one.
    actorId: user.id,
    kind: parsed.data.kind,
  });
}
