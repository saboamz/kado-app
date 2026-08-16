import { PageSkeleton } from '@/components/Skeleton';
import { getT } from '@/lib/i18n/server';

/** A list is a header and then as many gift cards as it holds. */
export default async function Loading() {
  const t = await getT();
  return <PageSkeleton rows={5} label={t('action.loading')} />;
}
