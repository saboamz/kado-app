import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { pageAlternates } from '@/lib/site';
import { IntentPage } from '../IntentPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('seo.wedding.title'),
    description: t('seo.wedding.metaDescription'),
    alternates: pageAlternates('/liste-de-mariage'),
  };
}

export default function WeddingPage() {
  return <IntentPage page="wedding" />;
}
