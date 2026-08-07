import type { Slot } from '@/lib/decorations';
import styles from './decoration.module.css';

export type DecorationView = {
  slot: string;
  gifUrl: string;
  stillUrl: string;
  width: number;
  height: number;
  title: string | null;
};

/**
 * A GIF somebody chose for their profile.
 *
 * ── Motion is a preference, not a detail ───────────────────────────────────
 *
 * An animated GIF is close to the top of the list of things
 * prefers-reduced-motion exists to stop: it loops forever, nobody can pause
 * it, and for some people it is genuinely disabling. The still frame is not a
 * lesser fallback — for those visitors it IS the decoration.
 *
 * <picture> does that without JavaScript: the browser picks before anything
 * loads, so a visitor who asked for less motion never downloads the animation
 * at all.
 *
 * ── Why not next/image ─────────────────────────────────────────────────────
 *
 * The optimiser re-encodes, and re-encoding an animation either kills it or
 * costs far more than serving the original. These come from a CDN already
 * sized by the provider.
 */
export function Decoration({
  decoration,
  slot,
}: {
  decoration: DecorationView;
  slot: Slot;
}) {
  return (
    <div className={`${styles.frame} ${styles[slot]}`}>
      <picture>
        <source srcSet={decoration.stillUrl} media="(prefers-reduced-motion: reduce)" />
        <img
          src={decoration.gifUrl}
          width={decoration.width}
          height={decoration.height}
          // Decorative, but not nothing: a screen reader saying "GIF" tells
          // the visitor nothing, and saying the title tells them what the
          // person chose to put there.
          alt={decoration.title ?? ''}
          loading="lazy"
          decoding="async"
          className={styles.image}
        />
      </picture>
    </div>
  );
}
