'use client';

import { useState, useTransition } from 'react';
import { deleteChatMessage, postChatMessage } from '@/lib/chat-actions';
import type { ChatMessageView } from '@/lib/chat';
import { formatRelative } from '@/lib/format';
import { Avatar } from './display';
import { Button } from './Button';
import { LockIcon } from './icons';
import styles from './chat.module.css';

/**
 * Where friends agree who buys what.
 *
 * Only ever rendered for friends: the page passes null for anybody else, so
 * an owner is not shown an empty room — they are shown no room.
 */
export function SecretChat({
  giftId,
  messages,
}: {
  giftId: string;
  messages: ChatMessageView[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  function send() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const result = await postChatMessage(giftId, body);
      if (result.error) setError(result.error);
      else setDraft('');
    });
  }

  return (
    <section className={styles.chat} aria-labelledby="chat-heading">
      <h2 id="chat-heading" className={styles.heading}>
        <LockIcon size={14} />
        Salon privé
      </h2>

      <p className={styles.intro}>
        Organisez-vous entre proches. Le propriétaire de la liste ne voit pas ce
        salon et ne sait pas qu&rsquo;il existe.
      </p>

      {messages.length === 0 ? (
        <p className={styles.empty}>
          Aucun message. Lancez la conversation.
        </p>
      ) : (
        <ul className={styles.messages}>
          {messages.map((message) => (
            <li
              key={message.id}
              className={styles.message}
              data-mine={message.mine ? '' : undefined}
            >
              <Avatar
                name={message.author.name}
                color={message.author.avatarColor}
                size={30}
              />
              <div className={styles.bubble}>
                <div className={styles.meta}>
                  <span className={styles.author}>
                    {message.mine ? 'Vous' : message.author.name}
                  </span>
                  <span className={styles.time}>
                    {formatRelative(message.createdAt)}
                  </span>
                </div>
                <p className={styles.body}>{message.body}</p>
                {message.mine && (
                  <button
                    type="button"
                    className={styles.delete}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteChatMessage(message.id);
                        if (result.error) setError(result.error);
                      })
                    }
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.compose}>
        <label className="srOnly" htmlFor="chat-message">
          Votre message
        </label>
        <textarea
          id="chat-message"
          className={styles.input}
          rows={2}
          placeholder="Je peux mettre 50 €…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line, as in any chat.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button disabled={pending || !draft.trim()} onClick={send}>
          {pending ? 'Envoi…' : 'Envoyer'}
        </Button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
