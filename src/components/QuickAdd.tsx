'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { enrichQuickGift, quickAddGift } from '@/lib/gift-actions';
import { useErrorText, useT } from '@/lib/i18n/client';
import { Button } from './Button';
import styles from './quickAdd.module.css';

/**
 * The single box: paste a link or write a wish, and it is on the list.
 *
 * Two server calls, deliberately split. The first creates the wish and is
 * quick — words become a wish outright, a link becomes one named after its
 * shop. router.refresh() then shows the card at once. The second call reads
 * the page and can take seconds; when it returns, another refresh fills the
 * card in. Somebody who closes the tab in between keeps the wish, only
 * without the trimmings — the same deal the save has always offered.
 *
 * The form behind « Ajouter » keeps every field for whoever wants to be
 * precise; this box is for the other ninety percent of adds.
 */
export function QuickAdd({ listId }: { listId: string }) {
  const t = useT();
  const router = useRouter();
  const errorText = useErrorText();
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<'idle' | 'adding' | 'reading'>('idle');
  const [error, setError] = useState<string | null>(null);
  // One add at a time: the ref, unlike state, is visible to the paste
  // listener registered below without re-subscribing on every keystroke.
  const busy = useRef(false);

  async function add(raw: string) {
    const input = raw.trim();
    if (!input || busy.current) return;
    busy.current = true;
    setError(null);
    setPhase('adding');

    const result = await quickAddGift(listId, input);
    if (result.error) {
      setError(result.error);
      setPhase('idle');
      busy.current = false;
      return;
    }

    setValue('');
    // The wish exists — show it before the slow half starts.
    router.refresh();

    if (result.giftId) {
      setPhase('reading');
      await enrichQuickGift(result.giftId);
      router.refresh();
    }
    setPhase('idle');
    busy.current = false;
  }

  /*
   * Pasting anywhere on the page adds the link, without hunting for the box.
   *
   * Only a lone URL qualifies — pasted prose is somebody trying to paste
   * into a field they missed, and must not become a wish. Focused inputs
   * keep their paste: the guard checks where the event landed.
   */
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable]')) return;
      const text = (event.clipboardData?.getData('text') ?? '').trim();
      if (!/^https?:\/\/\S+$/.test(text)) return;
      void add(text);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  return (
    <form
      className={styles.box}
      onSubmit={(event) => {
        event.preventDefault();
        void add(value);
      }}
    >
      <input
        className={styles.input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('lists.quickAddPlaceholder')}
        aria-label={t('lists.quickAddPlaceholder')}
        disabled={phase === 'adding'}
      />
      <Button type="submit" disabled={phase !== 'idle' || !value.trim()}>
        {t('lists.quickAddCta')}
      </Button>
      {phase === 'reading' && (
        <p className={styles.status} role="status">
          {t('form.linkReading')}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {errorText(error)}
        </p>
      )}
    </form>
  );
}
