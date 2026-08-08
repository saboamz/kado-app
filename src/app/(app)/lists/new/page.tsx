import type { Metadata } from 'next';
import { ListForm } from '@/components/ListForm';
import { PageHeader } from '@/components/PageHeader';
import { createList } from '@/lib/list-actions';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('lists.newTitle') };
}

export default async function NewListPage() {
  const t = await getT();
  return (
    <>
      <PageHeader
        title={t('lists.newTitle')}
        subtitle={t('lists.newSubtitle')}
        back={{ href: '/lists', label: t('lists.title') }}
      />
      <ListForm
        action={createList}
        submitLabel={t('lists.create')}
        pendingLabel={t('action.creating')}
      />
    </>
  );
}
