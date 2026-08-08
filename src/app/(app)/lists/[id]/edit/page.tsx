import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeleteListButton } from '@/components/DeleteButtons';
import { ListForm } from '@/components/ListForm';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/lib/db';
import { updateList } from '@/lib/list-actions';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from '@/components/forms.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('lists.editTitle') };
}

export default async function EditListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const user = await requireUser();

  const list = await db.giftList.findUnique({ where: { id } });
  // A list you do not own is indistinguishable from one that does not exist.
  if (!list || list.ownerId !== user.id) notFound();

  const action = updateList.bind(null, id);

  return (
    <>
      <PageHeader
        title={t('lists.editTitle')}
        back={{ href: `/lists/${id}`, label: list.name }}
      />
      <ListForm
        action={action}
        initial={list}
        submitLabel={t('common.save')}
        pendingLabel={t('action.saving')}
      />

      <div className={styles.danger}>
        <p className={styles.dangerTitle}>{t('lists.deleteList')}</p>
        <p className={styles.dangerBody}>
          La liste et ses envies seront définitivement supprimées, ainsi que les
          réservations que vos proches y ont faites.
        </p>
        <DeleteListButton listId={id} listName={list.name} />
      </div>
    </>
  );
}
