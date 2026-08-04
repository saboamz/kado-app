'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './ui.module.css';

/**
 * Search box that pushes the query into the URL.
 *
 * Debounced so typing does not fire a request per keystroke, and kept in the
 * URL so a search can be shared, bookmarked and survive a reload.
 */
export function SearchField({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      router.replace(`/search?${next.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, params, router]);

  return (
    <div className={styles.field} style={{ marginBottom: 20 }}>
      <label className="srOnly" htmlFor="people-search">
        Rechercher une personne
      </label>
      <input
        id="people-search"
        className={styles.input}
        type="search"
        placeholder="Nom ou adresse e-mail"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
