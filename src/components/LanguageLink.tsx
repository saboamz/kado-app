import Link from 'next/link';
import { headers } from 'next/headers';
import { getLocale } from '@/lib/i18n/server';
import { LOCALE_NAMES } from '@/lib/i18n/locales';
import { PATHNAME_HEADER, counterpart, pathFor } from '@/lib/public-pages';

/**
 * The same page, in the other language.
 *
 * The public pages take their language from their address, which means a
 * reader who wants the other one needs a way to say so — and a crawler needs
 * a link to follow, or /en exists only in the sitemap. This is both.
 *
 * Renders nothing anywhere else: a page with one address has no counterpart
 * to offer, and a dead language switch is worse than none.
 *
 * The label is never translated. "English" written in French is still
 * "English", and somebody looking for their own language scans for the word
 * they already know.
 */
export async function LanguageLink({ className }: { className?: string }) {
  const page = counterpart((await headers()).get(PATHNAME_HEADER));
  if (!page) return null;

  const other = (await getLocale()) === 'en' ? 'fr' : 'en';

  return (
    <Link href={pathFor(page, other)} hrefLang={other} className={className}>
      {LOCALE_NAMES[other]}
    </Link>
  );
}
