import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { pageAlternates } from '@/lib/site';
import { IntentPage } from '../IntentPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('seo.wishlist.title'),
    description: t('seo.wishlist.metaDescription'),
    alternates: pageAlternates('/liste-de-souhaits'),
  };
}

export default function WishlistPage() {
  return <IntentPage page="wishlist" />;
}
