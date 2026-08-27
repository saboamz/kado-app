import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/site';
import { intentPage } from '@/lib/public-pages';
import { IntentPage } from '../IntentPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return pageMetadata(intentPage('pot'), t('seo.pot.title'), t('seo.pot.metaDescription'));
}

export default function PotPage() {
  return <IntentPage page="pot" />;
}
