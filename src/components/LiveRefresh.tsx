'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Keeps a page up to date while somebody is looking at it.
 *
 * ── Why polling, and not something cleverer ────────────────────────────────
 *
 * Server-Sent Events are the elegant answer and the wrong one here. An open
 * SSE connection is a serverless function that never returns, billed as
 * execution time for as long as the tab is open — a handful of people with a
 * tab left open would spend the free tier in days. A hosted WebSocket
 * (Pusher, Ably) works and stays free at this size, but it is another service
 * holding another key, and it is not needed yet.
 *
 * router.refresh() re-runs the server components and hands React a new tree.
 * React reconciles it, so text somebody is typing and scroll position survive
 * — this is not a page reload.
 *
 * ── What makes it cheap ────────────────────────────────────────────────────
 *
 * Not the interval. A refresh costs three database queries on the gift page,
 * so what matters is how often nobody is watching: a tab left open for a week
 * would poll fifty thousand times to show nothing to nobody.
 *
 * So it stops when the tab is hidden, and refreshes ONCE on the way back —
 * which is also the moment the data is most likely to be stale. That single
 * rule removes almost all of the waste, and the interval only decides how
 * fresh an actively-watched page is.
 *
 * If this ever needs replacing with a pushed connection, this component is
 * the only thing that changes: everything it updates is already server-
 * rendered from the database.
 */
export function LiveRefresh({
  /**
   * How often to ask, in milliseconds, while the tab is in front.
   *
   * A pot moves on the scale of somebody deciding to chip in — ten seconds is
   * invisible. A conversation is faster, and a reply arriving four seconds
   * late still reads as a conversation.
   */
  intervalMs = 10_000,
  /** Off when there is nothing live on the page — no pot, no chat. */
  enabled = true,
}: {
  intervalMs?: number;
  enabled?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Once immediately: coming back to a tab is exactly when what is on
        // screen is most likely to be out of date.
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router, intervalMs, enabled]);

  return null;
}
