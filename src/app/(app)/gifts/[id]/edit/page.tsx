import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeleteGiftButton } from '@/components/DeleteButtons';
import { GiftForm } from '@/components/GiftForm';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/lib/db';
import { updateGift } from '@/lib/gift-actions';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from '@/components/forms.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('gift.editTitle') };
}

export default async function EditGiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const user = await requireUser();

  const gift = await db.gift.findUnique({
    where: { id },
    include: { list: { select: { ownerId: true, name: true } } },
  });
  if (!gift || gift.list.ownerId !== user.id) notFound();

  return (
    <>
      <PageHeader
        title={t('gift.editTitle')}
        back={{ href: `/gifts/${id}`, label: gift.name }}
      />
      <GiftForm
        action={updateGift.bind(null, id)}
        initial={gift}
        submitLabel={t('common.save')}
        pendingLabel={t('action.saving')}
      />

      <div className={styles.danger}>
        <p className={styles.dangerTitle}>{t('gift.deleteGift')}</p>
        <p className={styles.dangerBody}>
          Elle disparaîtra de votre liste, ainsi que toute réservation la
          concernant.
        </p>
        <DeleteGiftButton giftId={id} giftName={gift.name} />
      </div>
    </>
  );
}
