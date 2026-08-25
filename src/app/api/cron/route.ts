import { NextResponse } from 'next/server';
import { buildItemSimilarity } from '@/lib/cf';
import { promoteQuarantined, sweepUnlinkedGifts } from '@/lib/gift-product-link';
import { backfillMerchants } from '@/lib/merchants';
import { purgeExpiredResets } from '@/lib/password-reset';
import { purgeOldAttempts } from '@/lib/rate-limit';
import { refreshPopularity } from '@/lib/reco';

/**
 * The nightly recompute, as an endpoint because Vercel has no other way to
 * run one.
 *
 * Two jobs, both of which the recommender's comments describe as nightly and
 * neither of which was wired to anything:
 *
 *   refreshPopularity   — recomputes Product.popularity from the event log,
 *                         applying the 180-day decay. Recomputed rather than
 *                         incremented so a correction to the weights, or a
 *                         purge of forged events, actually takes effect.
 *   buildItemSimilarity — rebuilds the item-item matrix. Precomputed on
 *                         purpose: the serving path must stay one indexed
 *                         select.
 *
 * The embedding job is deliberately NOT here. It loads a 400 MB transformer
 * model, which does not fit a serverless function's memory or its time limit —
 * it stays `npm run embed`, run against the database when the catalogue grows.
 *
 * ── Why the secret is required ─────────────────────────────────────────────
 *
 * Both jobs are expensive and write to shared tables. An open endpoint would
 * let anyone spin the database at will, and on a metered free tier that is a
 * denial of service that also costs money. Vercel Cron sends CRON_SECRET as a
 * bearer token; nothing else may trigger this.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Refuse rather than run unprotected. A missing secret is a misconfiguration,
  // and treating it as "no auth needed" is how an open endpoint ships.
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured.' },
      { status: 503 },
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const startedAt = Date.now();

  // Both read the event log and write different tables, so the order between
  // them does not matter. Run in sequence rather than in parallel: each is a
  // heavy aggregate query, and the free tier's compute is the scarce resource.
  const popularity = await refreshPopularity();
  const similarity = await buildItemSimilarity();
  // Rate-limit rows are only read inside a window measured in minutes;
  // anything older than a day is dead weight.
  const attemptsPurged = await purgeOldAttempts();
  const resetsPurged = await purgeExpiredResets();

  /*
   * Retry the links that never resolved.
   *
   * Last, and with a budget: it makes outbound requests to third parties, so
   * it is the only job here whose duration we do not control. The two
   * aggregates above matter more and have already finished by this point.
   */
  const sweep = await sweepUnlinkedGifts();

  /*
   * Give the quarantined rows another chance.
   *
   * After the sweep, and sharing its shape: outbound requests to third
   * parties, bounded by a count and a clock. A merchant behind a bot check
   * when the wish was saved usually serves the real page later.
   */
  const promotion = await promoteQuarantined();

  /*
   * Attach merchants to rows written before merchants existed.
   *
   * Purely local work — no outbound request — so it is cheap, and it is
   * idempotent: once every row has a merchant this finds nothing and costs
   * one indexed query a night.
   */
  const backfill = await backfillMerchants();

  return NextResponse.json({
    ok: true,
    popularityRowsUpdated: popularity,
    similarityPairsWritten: similarity,
    attemptsPurged,
    resetsPurged,
    giftsRetried: sweep.attempted,
    giftsLinked: sweep.linked,
    quarantineRetried: promotion.attempted,
    quarantinePromoted: promotion.promoted,
    merchantsAttached: backfill.attached,
    ms: Date.now() - startedAt,
  });
}
