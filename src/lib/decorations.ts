/**
 * Where a GIF may go on a profile, and what one looks like once stored.
 *
 * ── Why a fixed set of slots ───────────────────────────────────────────────
 *
 * "Anywhere they like" is a layout editor: drag, drop, resize, touch targets,
 * and a saved geometry that has to survive every screen width. It also lets a
 * profile become unreadable — and this page exists so a friend can choose a
 * present, so decoration must not get in the way of that.
 *
 * Fixed slots keep the part that matters (it is YOUR page and it looks like
 * you) while the layout stays something the app controls.
 */

export const SLOTS = ['banner', 'beside', 'footer'] as const;
export type Slot = (typeof SLOTS)[number];

/** What each slot is, in the words shown to the person choosing. */
export const SLOT_LABELS: Record<Slot, { name: string; hint: string }> = {
  banner: {
    name: 'Bandeau',
    hint: 'En haut de votre profil, sur toute la largeur.',
  },
  beside: {
    name: 'À côté de votre nom',
    hint: 'Un petit GIF posé près de votre photo.',
  },
  footer: {
    name: 'En bas de page',
    hint: 'Après vos listes, comme une signature.',
  },
};

export function isSlot(value: unknown): value is Slot {
  return typeof value === 'string' && (SLOTS as readonly string[]).includes(value);
}

/** A GIF as the picker offers it, and as it is stored. */
export type GifChoice = {
  /** The provider's id, so the same GIF is recognisable across searches. */
  id: string;
  gifUrl: string;
  stillUrl: string;
  width: number;
  height: number;
  title: string | null;
};

/**
 * The hosts a decoration may be served from.
 *
 * Checked when the choice comes back from the client, which is the only point
 * where a URL could be substituted: the picker posts what it was given, and
 * nothing stops a crafted request posting something else. Without this, any
 * profile could be turned into a beacon pointed at a server of the sender's
 * choosing.
 */
const ALLOWED_HOSTS = [
  'media.giphy.com',
  'media0.giphy.com',
  'media1.giphy.com',
  'media2.giphy.com',
  'media3.giphy.com',
  'media4.giphy.com',
  'i.giphy.com',
];

export function isAllowedGifUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
