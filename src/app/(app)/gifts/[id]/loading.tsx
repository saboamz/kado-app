import { PageSkeleton } from '@/components/Skeleton';
import { getT } from '@/lib/i18n/server';

/**
 * A gift page is one tall block — photo, price, link — not a list of rows,
 * and it is the slowest route in the app: several round trips before
 * anything renders. Two generous rows suggest that shape better than four
 * short ones.
 */
export default async function Loading() {
  const t = await getT();
  return <PageSkeleton rows={2} label={t('action.loading')} />;
}
