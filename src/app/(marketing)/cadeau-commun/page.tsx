import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { pageAlternates } from '@/lib/site';
import { IntentPage } from '../IntentPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('seo.group.title'),
    description: t('seo.group.metaDescription'),
    alternates: pageAlternates('/cadeau-commun'),
  };
}

export default function GroupGiftPage() {
  return <IntentPage page="group" />;
}
