import { avatarTint, initials } from '@/lib/format';
import type { ViewerRelation } from '@/lib/secrecy';
import { UploadedImage } from './UploadedImage';
import styles from './viewpoint.module.css';

/**
 * The banner that says whose screen you are on.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * A user crosses between "my list" and "someone else's list" constantly, and
 * what they can do changes completely: on their own screens there is never a
 * reservation state, on a friend's there always is. Nothing used to signal
 * that crossing, so the absence of a reserve button read as a missing feature
 * rather than as the rule working.
 *
 * ── Why it renders nothing for an owner ────────────────────────────────────
 *
 * The design is explicit: on your own screens there is no banner at all. The
 * absence is the signal, and it only works because it is absolute — a banner
 * saying "your list" would make the ochre one a decoration rather than a
 * boundary. Returning null here is the whole point, not an optimisation.
 */
export function ViewpointBanner({
  relation,
  person,
  what = 'la liste',
}: {
  relation: ViewerRelation;
  person: { name: string; avatarUrl?: string | null };
  /** What is being looked at, to complete "Vous regardez …". */
  what?: string;
}) {
  if (relation === 'owner') return null;

  const tint = avatarTint(person.name);
  // The first name is enough here and keeps the line short on a phone; the
  // full name is already in the page title underneath.
  const firstName = person.name.trim().split(/\s+/)[0] ?? person.name;

  return (
    <div className={styles.banner}>
      {person.avatarUrl ? (
        <UploadedImage
          src={person.avatarUrl}
          className={styles.photo}
          width={26}
          height={26}
        />
      ) : (
        <span
          className={styles.initials}
          style={{ background: tint.bg, color: tint.fg }}
          aria-hidden
        >
          {initials(person.name)}
        </span>
      )}

      <span className={styles.text}>
        Vous regardez {what} de <strong>{firstName}</strong>
      </span>

      <span className={styles.chip}>
        {relation === 'friend' ? 'Ami' : 'Visiteur'}
      </span>
    </div>
  );
}
