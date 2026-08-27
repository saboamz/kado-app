import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/site';
import { intentPage } from '@/lib/public-pages';
import { IntentPage } from '../IntentPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return pageMetadata(
    intentPage('group'),
    t('seo.group.title'),
    t('seo.group.metaDescription'),
  );
}

export default function GroupGiftPage() {
  return <IntentPage page="group" />;
}
