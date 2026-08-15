'use client';

import { recordTelemetry } from '@/lib/event-actions';

/**
 * A link out to a merchant, counted on the way past.
 *
 * ── Why count at all ───────────────────────────────────────────────────────
 *
 * Two reasons, and they are worth keeping apart because only one of them is
 * about money.
 *
 * The recommender already gives `click_out` a weight of 1.0 — a click is a
 * mild statement of taste, well below a reservation and well above a page
 * view. That weight has been sitting in WEIGHTS unused, because nothing in
 * the app ever emitted the event. This is the emitter.
 *
 * The second reason is that affiliate networks ask how much outbound traffic
 * a site sends before they approve it, and the honest answer requires having
 * counted. No affiliate link exists yet and none is added here: this only
 * makes the number knowable.
 *
 * ── Why an owner is not counted ────────────────────────────────────────────
 *
 * The app's one invariant is that a list owner never learns their gift drew
 * interest. A click event on somebody else's wish is exactly that kind of
 * interest, so a friend's click is recorded and an owner's is not.
 *
 * To be clear about what this skip is and is not: today no screen anywhere
 * reads GiftEvent — cf.ts counts rows in aggregate, and that is the whole of
 * it — so an owner could not see these rows even if we wrote them. The skip
 * is not what keeps the secret today. It is a refusal to accumulate a record
 * of who looked at what, on the wish of somebody who is entitled to know
 * nothing about it, against the day some future screen does read this table.
 * The cheapest moment to not have that data is before writing it.
 *
 * An owner clicking their own link is also worthless as taste evidence: they
 * chose the thing, we already know they want it, and add_wish said so at
 * weight 3.0.
 *
 * ── Why the navigation does not wait ───────────────────────────────────────
 *
 * No await, no preventDefault. The browser follows the href as it always
 * would and the action is fired alongside it; recordTelemetry is `void`,
 * swallows its own failures, and is not permitted to have an opinion about
 * whether the link opens. A dropped row costs a data point. A blocked link
 * costs somebody the thing they were trying to buy.
 *
 * target="_blank" is what makes this safe to do so casually: the page stays
 * alive in its own tab, so the in-flight request is not cancelled by a
 * navigation away.
 */
export function OutboundLink({
  href,
  giftId,
  productId,
  isOwner,
  className,
  children,
}: {
  href: string;
  giftId: string;
  /** Null when the link never resolved to a catalogue row. */
  productId?: string | null;
  /** True when the viewer owns the list this wish is on. */
  isOwner: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      // nofollow stays: these are user-submitted URLs, and we do not vouch
      // for them. sponsored would be the tag to add if an affiliate
      // parameter is ever appended — it is not, yet.
      rel="noopener noreferrer nofollow"
      className={className}
      onClick={() => {
        if (isOwner) return;
        void recordTelemetry({ kind: 'click_out', giftId, productId });
      }}
    >
      {children}
    </a>
  );
}
