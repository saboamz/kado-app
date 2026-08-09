'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  acceptFriendship,
  removeFriendship,
  requestFriendship,
} from '@/lib/friend-actions';
import type { PersonResult } from '@/lib/people';
import { useErrorText, useT } from '@/lib/i18n/client';
import { Avatar } from './display';
import { Button } from './Button';
import styles from './person.module.css';

/** One person, with whatever action their current relation allows. */
export function PersonCard({ person }: { person: PersonResult }) {
  const t = useT();
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={styles.card}>
      <Link href={`/u/${person.id}`} className={styles.identity}>
        <Avatar
          name={person.name}
          url={person.avatarUrl}
          size={44}
        />
        <span className={styles.text}>
          <span className={styles.name}>{person.name}</span>
          <span className={styles.meta}>
            {t('common.lists', { count: person.listCount })}
            {person.bio ? ` · ${person.bio}` : ''}
          </span>
        </span>
      </Link>

      <div className={styles.action}>
        {person.relation === 'none' && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => requestFriendship(person.id))}
          >
            {t('friend.add')}
          </Button>
        )}

        {person.relation === 'pending-sent' && (
          <span className={styles.pendingLabel}>{t('friend.requestSent')}</span>
        )}

        {person.relation === 'pending-received' && person.friendshipId && (
          <>
            <Button
              disabled={pending}
              onClick={() => run(() => acceptFriendship(person.friendshipId!))}
            >
              {t('friend.accept')}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => removeFriendship(person.friendshipId!))}
            >
              {t('friend.decline')}
            </Button>
          </>
        )}

        {person.relation === 'friend' && person.friendshipId && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => removeFriendship(person.friendshipId!))}
          >
            {t('friend.remove')}
          </Button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}
