'use client';

import { useEffect, useState, useTransition } from 'react';
import { rotateInvite } from '@/lib/invite-actions';
import { useErrorText, useT } from '@/lib/i18n/client';
import styles from './inviteLink.module.css';

/**
 * The link somebody pastes into a family group chat.
 *
 * Copy is the primary action, with the native share sheet offered when the
 * device has one — on a phone that is how a link actually reaches WhatsApp,
 * and it is where these get shared.
 */
export function InviteLink({ code, uses }: { code: string; uses: number }) {
  const t = useT();
  const errorText = useErrorText();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * Built in the browser, after mount.
   *
   * The origin has to come from the client: behind a proxy the server does not
   * reliably know its own public hostname, and getting it wrong produces a
   * link that 404s for everyone who follows it.
   *
   * Reading window during render rather than in an effect is what caused a
   * hydration mismatch — the server rendered the placeholder and the client
   * rendered the real URL, so React discarded the tree and warned. An effect
   * runs only on the client, after the two agree.
   */
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const url = origin ? `${origin}/i/${code}` : '';

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Kado',
          text: 'Rejoins-moi sur Kado pour voir ma liste d’envies.',
          url,
        });
        return;
      } catch {
        // Dismissed, or unavailable. Fall through to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.lede}>
        Partagez ce lien : la personne le suit, crée son compte, et vous êtes
        amis. Pas de recherche, pas de demande à accepter.
      </p>

      <div className={styles.row}>
        <code className={styles.url}>{url || `…/i/${code}`}</code>
        <button type="button" className={styles.copy} onClick={share}>
          {copied ? t('action.copied') : 'Partager'}
        </button>
      </div>

      <div className={styles.footer}>
        <span className={styles.uses}>
          {uses === 0
            ? t('invite.unused')
            : uses === 1
              ? '1 personne vous a rejoint par ce lien.'
              : `${uses} personnes vous ont rejoint par ce lien.`}
        </span>
        <button
          type="button"
          className={styles.rotate}
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await rotateInvite();
              if (result.error) setError(errorText(result.error) ?? null);
            })
          }
        >
          {pending ? t('invite.rotating') : t('invite.rotate')}
        </button>
      </div>

      {/* Rotating invalidates every link already shared, so a rotation that
          quietly failed is the worst outcome: you believe the old link is
          dead when it is still live. */}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
