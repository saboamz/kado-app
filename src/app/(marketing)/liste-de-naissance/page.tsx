import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { pageAlternates } from '@/lib/site';
import { IntentPage } from '../IntentPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('seo.birth.title'),
    description: t('seo.birth.metaDescription'),
    alternates: pageAlternates('/liste-de-naissance'),
  };
}

export default function BirthPage() {
  return <IntentPage page="birth" />;
}
