import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/Button';
import { Badge, Card, PriorityStars } from '@/components/display';
import { PageHeader } from '@/components/PageHeader';
import { ReserveButton } from '@/components/ReserveButton';
import { db } from '@/lib/db';
import { formatMoney, priorityLabel } from '@/lib/format';
import { canViewList, relationTo } from '@/lib/relations';
import { giftInclude, viewGift } from '@/lib/secrecy';
import { getCurrentUser } from '@/lib/session';
import styles from './gift.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const gift = await db.gift.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: gift?.name ?? 'Cadeau' };
}

export default async function GiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const viewerId = viewer?.id ?? null;

  const owning = await db.gift.findUnique({
    where: { id },
    select: {
      list: {
        select: { id: true, name: true, ownerId: true, visibility: true },
      },
    },
  });
  if (!owning) notFound();

  const relation = await relationTo(viewerId, owning.list.ownerId);
  if (!canViewList(owning.list.visibility, relation)) notFound();

  // The include is chosen by relation: an owner's query never joins the
  // reservation or contribution tables at all.
  const row = await db.gift.findUniqueOrThrow({
    where: { id },
    include: giftInclude(relation),
  });
  const gift = viewGift(row, relation, viewerId);
  const isOwner = relation === 'owner';

  return (
    <>
      <PageHeader
        title={gift.name}
        back={{ href: `/lists/${owning.list.id}`, label: owning.list.name }}
        actions={
          isOwner && (
            <ButtonLink href={`/gifts/${id}/edit`} variant="secondary">
              Modifier
            </ButtonLink>
          )
        }
      />

      <div className={styles.headline}>
        <span className={styles.price}>
          {formatMoney(gift.priceCents, gift.currency)}
        </span>
        <PriorityStars priority={gift.priority} />
        <span className={styles.priorityLabel}>
          {priorityLabel(gift.priority)}
        </span>
      </div>

      <div className={styles.flags}>
        {gift.isPot && <Badge tone="solid">Cadeau à plusieurs</Badge>}
        {gift.category && <Badge>{gift.category}</Badge>}
        {gift.reservation?.state === 'mine' && (
          <Badge tone="accent">Vous l&rsquo;avez réservé</Badge>
        )}
        {gift.reservation?.state === 'taken' && <Badge>Déjà réservé</Badge>}
      </div>

      {gift.description && (
        <p className={styles.description}>{gift.description}</p>
      )}

      {gift.url && (
        <Card plain className={styles.link}>
          <a href={gift.url} target="_blank" rel="noopener noreferrer nofollow">
            <span className={styles.linkMerchant}>
              {gift.merchant ?? 'Voir le produit'}
            </span>
            <span className={styles.linkUrl}>{gift.url}</span>
          </a>
        </Card>
      )}

      {/*
        Rendered only when gift.reservation exists, which it never does for
        an owner: there is no branch here that could leak to them.
      */}
      {gift.reservation && !gift.isPot && (
        <ReserveButton giftId={id} reservation={gift.reservation} />
      )}

      {/*
        The reassurance differs by role, and for the owner it is literally
        true of this page: no reservation data was fetched to render it.
      */}
      <Card plain className={styles.secrecy}>
        {isOwner
          ? "Vue propriétaire : aucune information de réservation n'existe sur cette page."
          : gift.reservation?.state === 'free'
            ? 'Si vous le réservez, cela restera invisible pour le propriétaire de la liste.'
            : "Le propriétaire de la liste ne voit rien de tout ceci."}
      </Card>
    </>
  );
}
