import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GiftForm } from '@/components/GiftForm';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/lib/db';
import { createGift } from '@/lib/gift-actions';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Ajouter une envie' };

export default async function NewGiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const list = await db.giftList.findUnique({ where: { id } });
  if (!list || list.ownerId !== user.id) notFound();

  return (
    <>
      <PageHeader
        title="Ajouter une envie"
        subtitle={`Dans « ${list.name} »`}
        back={{ href: `/lists/${id}`, label: list.name }}
      />
      <GiftForm
        action={createGift.bind(null, id)}
        submitLabel="Ajouter à ma liste"
        pendingLabel="Ajout…"
      />
    </>
  );
}
