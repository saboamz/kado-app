import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GiftForm } from '@/components/GiftForm';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/lib/db';
import { createGift } from '@/lib/gift-actions';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('gift.addTitle') };
}

export default async function NewGiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const user = await requireUser();

  const list = await db.giftList.findUnique({ where: { id } });
  if (!list || list.ownerId !== user.id) notFound();

  return (
    <>
      <PageHeader
        title={t('gift.addTitle')}
        subtitle={`Dans « ${list.name} »`}
        back={{ href: `/lists/${id}`, label: list.name }}
      />
      <GiftForm
        action={createGift.bind(null, id)}
        submitLabel={t('gift.addCta')}
        pendingLabel={t('gift.adding')}
      />
    </>
  );
}
