import { db } from './db';

/**
 * How much traffic this app sends to each shop.
 *
 * ── What it is for ─────────────────────────────────────────────────────────
 *
 * Affiliate networks ask this before they approve an account, and the honest
 * answer needs a count rather than an estimate. Nothing here creates an
 * affiliate link or appends a tracking parameter — this only makes the number
 * knowable, so that the application form can be filled in truthfully.
 *
 * ── Why it counts people, not clicks ───────────────────────────────────────
 *
 * `clicks` is every event; `people` is the distinct actors behind them. Both
 * are reported because they answer different questions, and a gap between
 * them is the interesting signal: one person clicking a link forty times is
 * not forty people, and a network that is told otherwise will find out.
 *
 * ── The unattributed bucket ────────────────────────────────────────────────
 *
 * A click carries a giftId always and a productId only when the wish's link
 * resolved to a catalogue row — which happens for four of the five links in
 * this database today. A merchant is reachable only through that product, so
 * clicks on unresolved links belong to no shop.
 *
 * They are returned as a separate total rather than dropped. A function that
 * silently discarded them would report a number smaller than the truth while
 * looking complete, and the whole point of this is to be able to state a
 * figure and stand behind it.
 *
 * ── Why this reads no secret ───────────────────────────────────────────────
 *
 * The result is per-merchant, aggregated across every user, and mentions no
 * gift, no list and no person. It cannot tell anybody that a particular wish
 * drew interest, which is the property the whole app is built around. Never
 * call this per-gift: an owner asking "how many clicks on MY wish" is exactly
 * the question this app exists to refuse.
 */

export type MerchantClicks = {
  merchant: string;
  slug: string;
  clicks: number;
  /** Distinct people. Always ≤ clicks. */
  people: number;
};

export type ClickOutReport = {
  byMerchant: MerchantClicks[];
  /** Every click, including the ones no merchant could be found for. */
  totalClicks: number;
  /** Clicks on a link that never resolved to a catalogue row. */
  unattributedClicks: number;
  since: Date;
};

/**
 * Outbound clicks over the last `days`, grouped by shop.
 *
 * Raw SQL because this is a group-by over a two-hop join (event → product →
 * merchant) with a distinct count, and expressing it through the query
 * builder would mean pulling every row into memory to group it there.
 */
export async function clickOutReport(days = 30): Promise<ClickOutReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db.$queryRaw<
    { name: string; slug: string; clicks: bigint; people: bigint }[]
  >`
    SELECT m.name,
           m.slug,
           COUNT(*)                       AS clicks,
           COUNT(DISTINCT e."actorId")    AS people
      FROM "GiftEvent" e
      JOIN "Product"  p ON p.id = e."productId"
      JOIN "Merchant" m ON m.id = p."merchantId"
     WHERE e.kind = 'click_out'
       AND e."occurredAt" >= ${since}
     GROUP BY m.name, m.slug
     ORDER BY clicks DESC
  `;

  const totalClicks = await db.giftEvent.count({
    where: { kind: 'click_out', occurredAt: { gte: since } },
  });

  const attributed = rows.reduce((sum, row) => sum + Number(row.clicks), 0);

  return {
    byMerchant: rows.map((row) => ({
      merchant: row.name,
      slug: row.slug,
      clicks: Number(row.clicks),
      people: Number(row.people),
    })),
    totalClicks,
    // Not a separate query: it is the difference by definition, and two
    // queries could disagree if a click landed between them.
    unattributedClicks: totalClicks - attributed,
    since,
  };
}
