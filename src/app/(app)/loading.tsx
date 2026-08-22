import { PageSkeleton } from '@/components/Skeleton';
import { getT } from '@/lib/i18n/server';

/**
 * The default frame for every signed-in route.
 *
 * It sits inside the app layout, so the tab bar and the shell stay put and
 * only the content column is replaced — the navigation never blinks. Routes
 * whose shape differs enough to be worth saying so declare their own.
 */
export default async function Loading() {
  const t = await getT();
  return <PageSkeleton label={t('action.loading')} />;
}
