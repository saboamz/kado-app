'use client';

import { useEffect, useState, useTransition } from 'react';
import { rotateInvite } from '@/lib/invite-actions';
import styles from './inviteLink.module.css';

/**
 * The link somebody pastes into a family group chat.
 *
 * Copy is the primary action, with the native share sheet offered when the
 * device has one — on a phone that is how a link actually reaches WhatsApp,
 * and it is where these get shared.
 */
export function InviteLink({ code, uses }: { code: string; uses: number }) {
  const [copied, setCopied] = useState(false);
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
          {copied ? 'Copié' : 'Partager'}
        </button>
      </div>

      <div className={styles.footer}>
        <span className={styles.uses}>
          {uses === 0
            ? 'Personne ne l’a encore utilisé.'
            : uses === 1
              ? '1 personne vous a rejoint par ce lien.'
              : `${uses} personnes vous ont rejoint par ce lien.`}
        </span>
        <button
          type="button"
          className={styles.rotate}
          disabled={pending}
          onClick={() => startTransition(() => void rotateInvite())}
        >
          {pending ? 'Un instant…' : 'Générer un nouveau lien'}
        </button>
      </div>
    </div>
  );
}
