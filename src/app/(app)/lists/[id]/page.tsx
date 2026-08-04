import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/Button';
import {
  Badge,
  CardLink,
  EmptyState,
  Grid,
  PriorityStars,
} from '@/components/display';
import { GiftIcon, PlusIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { UploadedImage } from '@/components/UploadedImage';
import { formatMoney } from '@/lib/format';
import { getListForViewer } from '@/lib/gifts';
import { getCurrentUser } from '@/lib/session';
import styles from './list.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const list = await getListForViewer(id, user?.id ?? null);
  return { title: list?.name ?? 'Liste' };
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const list = await getListForViewer(id, user?.id ?? null);

  // Not found and not allowed look identical: otherwise a 403 would confirm
  // that a private list exists.
  if (!list) notFound();

  const isOwner = list.owner.id === user?.id;
  const gifts = list.gifts ?? [];

  return (
    <>
      <PageHeader
        title={list.name}
        subtitle={
          isOwner ? (
            list.occasion
          ) : (
            <>
              Liste de {list.owner.name}
              {list.occasion ? ` · ${list.occasion}` : ''}
            </>
          )
        }
        back={
          isOwner
            ? { href: '/lists', label: 'Mes listes' }
            : { href: `/u/${list.owner.id}`, label: list.owner.name }
        }
        actions={
          isOwner && (
            <>
              <ButtonLink href={`/lists/${id}/gifts/new`}>
                <PlusIcon size={18} />
                Ajouter
              </ButtonLink>
              <ButtonLink href={`/lists/${id}/edit`} variant="secondary">
                Modifier
              </ButtonLink>
            </>
          )
        }
      />

      <p className={styles.summary}>
        {gifts.length} envie{gifts.length > 1 ? 's' : ''}
        {/*
          Only a friend sees how many are spoken for. Telling the owner
          "2 réservées" gives away most of the surprise without naming anybody.
        */}
        {list.reservedCount !== undefined && list.reservedCount > 0 && (
          <> · {list.reservedCount} déjà réservée{list.reservedCount > 1 ? 's' : ''}</>
        )}
      </p>

      {gifts.length === 0 ? (
        <EmptyState
          icon={<GiftIcon size={24} />}
          title="Cette liste est vide"
          body={
            isOwner
              ? 'Ajoutez une envie : un lien, un prix, ou simplement une idée.'
              : "Rien à offrir ici pour l'instant."
          }
          action={
            isOwner && (
              <ButtonLink href={`/lists/${id}/gifts/new`}>
                Ajouter une envie
              </ButtonLink>
            )
          }
        />
      ) : (
        <Grid>
          {gifts.map((gift) => (
            <CardLink key={gift.id} href={`/gifts/${gift.id}`}>
              {gift.imageUrl && (
                <UploadedImage
                  src={gift.imageUrl}
                  className={styles.giftPhoto}
                />
              )}

              <div className={styles.giftTop}>
                <span className={styles.giftName}>{gift.name}</span>
                <PriorityStars priority={gift.priority} />
              </div>

              <div className={styles.giftMeta}>
                <span className={styles.price}>
                  {formatMoney(gift.priceCents, gift.currency)}
                </span>
                {gift.merchant && (
                  <span className={styles.merchant}>{gift.merchant}</span>
                )}
              </div>

              <div className={styles.flags}>
                {gift.isPot && <Badge tone="solid">Cagnotte</Badge>}
                {/*
                  gift.reservation is undefined for the owner — not "free",
                  undefined. There is nothing here to render for them.
                */}
                {gift.reservation?.state === 'mine' && (
                  <Badge tone="accent">Réservé par vous</Badge>
                )}
                {gift.reservation?.state === 'taken' && (
                  <Badge>Déjà réservé</Badge>
                )}
              </div>
            </CardLink>
          ))}
        </Grid>
      )}
    </>
  );
}
