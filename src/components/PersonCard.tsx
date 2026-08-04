'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  acceptFriendship,
  removeFriendship,
  requestFriendship,
} from '@/lib/friend-actions';
import type { PersonResult } from '@/lib/people';
import { Avatar } from './display';
import { Button } from './Button';
import styles from './person.module.css';

/** One person, with whatever action their current relation allows. */
export function PersonCard({ person }: { person: PersonResult }) {
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
          color={person.avatarColor}
          url={person.avatarUrl}
          size={44}
        />
        <span className={styles.text}>
          <span className={styles.name}>{person.name}</span>
          <span className={styles.meta}>
            {person.listCount} liste{person.listCount > 1 ? 's' : ''}
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
            Ajouter
          </Button>
        )}

        {person.relation === 'pending-sent' && (
          <span className={styles.pendingLabel}>Demande envoyée</span>
        )}

        {person.relation === 'pending-received' && person.friendshipId && (
          <>
            <Button
              disabled={pending}
              onClick={() => run(() => acceptFriendship(person.friendshipId!))}
            >
              Accepter
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => removeFriendship(person.friendshipId!))}
            >
              Refuser
            </Button>
          </>
        )}

        {person.relation === 'friend' && person.friendshipId && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => removeFriendship(person.friendshipId!))}
          >
            Retirer
          </Button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
