'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useTransition } from 'react';
import {
  clearDecoration,
  findGifs,
  setDecoration,
} from '@/lib/decoration-actions';
import { SLOTS, SLOT_LABELS, type GifChoice, type Slot } from '@/lib/decorations';
import type { DecorationView } from './Decoration';
import styles from './decorationPicker.module.css';

/**
 * Choosing what goes where on your profile.
 *
 * One slot is being edited at a time. A grid of every slot with its own
 * search would be four searches on screen at once, on a phone, which is how a
 * settings page becomes unusable.
 */
export function DecorationPicker({
  initial,
}: {
  initial: Record<string, DecorationView>;
}) {
  const [current, setCurrent] = useState(initial);
  const [editing, setEditing] = useState<Slot | null>(null);

  return (
    <div className={styles.wrap}>
      <p className={styles.lede}>
        Ajoutez des GIFs à votre profil — c’est ce que vos proches voient en
        venant chercher une idée de cadeau.
      </p>

      <ul className={styles.slots}>
        {SLOTS.map((slot) => (
          <li key={slot} className={styles.slot}>
            <div className={styles.slotHead}>
              <span className={styles.slotName}>{SLOT_LABELS[slot].name}</span>
              <span className={styles.slotHint}>{SLOT_LABELS[slot].hint}</span>
            </div>

            {current[slot] ? (
              <div className={styles.preview}>
                <img
                  src={current[slot]!.stillUrl}
                  alt=""
                  className={styles.previewImage}
                />
                <RemoveButton
                  slot={slot}
                  onDone={() =>
                    setCurrent((c) => {
                      const next = { ...c };
                      delete next[slot];
                      return next;
                    })
                  }
                />
              </div>
            ) : (
              <span className={styles.empty}>Rien pour l’instant</span>
            )}

            <button
              type="button"
              className={styles.choose}
              onClick={() => setEditing(editing === slot ? null : slot)}
            >
              {editing === slot
                ? 'Fermer'
                : current[slot]
                  ? 'Changer'
                  : 'Choisir un GIF'}
            </button>

            {editing === slot && (
              <Search
                onPick={(gif) => {
                  setCurrent((c) => ({
                    ...c,
                    [slot]: { slot, ...gif, title: gif.title },
                  }));
                  setEditing(null);
                }}
                slot={slot}
              />
            )}
          </li>
        ))}
      </ul>

      <p className={styles.credit}>
        GIFs fournis par GIPHY. Ils sont chargés depuis les serveurs de GIPHY,
        qui voit donc la visite de vos amis sur votre profil.
      </p>
    </div>
  );
}

function RemoveButton({ slot, onDone }: { slot: Slot; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={styles.remove}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await clearDecoration(slot);
          onDone();
        })
      }
    >
      {pending ? '…' : 'Retirer'}
    </button>
  );
}

function Search({
  slot,
  onPick,
}: {
  slot: Slot;
  onPick: (gif: GifChoice) => void;
}) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifChoice[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'unconfigured' | 'failed'>(
    'loading',
  );
  const [pending, startTransition] = useTransition();

  // Debounced: a request per keystroke would burn the search budget in one
  // word, and the trending set covers an empty query so the grid is never
  // blank on open.
  useEffect(() => {
    setStatus('loading');
    const timer = setTimeout(async () => {
      const result = await findGifs(query);
      if (result.ok) {
        setGifs(result.gifs);
        setStatus('idle');
      } else {
        setGifs([]);
        setStatus(result.reason);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className={styles.search}>
      <label className="srOnly" htmlFor={`gif-search-${slot}`}>
        Rechercher un GIF
      </label>
      <input
        id={`gif-search-${slot}`}
        className={styles.input}
        placeholder="Chercher : chat, merci, anniversaire…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {status === 'unconfigured' && (
        <p className={styles.notice}>
          La recherche de GIFs n’est pas encore configurée sur ce serveur.
        </p>
      )}
      {status === 'failed' && (
        <p className={styles.notice}>
          La recherche n’a pas répondu. Réessayez dans un instant.
        </p>
      )}
      {status === 'loading' && <p className={styles.notice}>Recherche…</p>}

      {gifs.length > 0 && (
        <ul className={styles.grid}>
          {gifs.map((gif) => (
            <li key={gif.id}>
              <button
                type="button"
                className={styles.gifButton}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await setDecoration(slot, gif);
                    if (!result.error) onPick(gif);
                  })
                }
              >
                {/* The still in the grid: two dozen looping animations at
                    once is unreadable, and costs a lot of data on a phone. */}
                <img src={gif.stillUrl} alt={gif.title ?? ''} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
