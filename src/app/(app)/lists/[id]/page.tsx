import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/Button';
import {
  Badge,
  CardLink,
  EmptyState,
  Grid,
  Priority,
} from '@/components/display';
import { GiftIcon, PlusIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { QuickAdd } from '@/components/QuickAdd';
import { ViewpointBanner } from '@/components/Viewpoint';
import { UploadedImage } from '@/components/UploadedImage';
import { distinctOccasion, formatMoney } from '@/lib/format';
import { getListForViewer } from '@/lib/gifts';
import { getCurrentUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
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
  const t = await getT();
  const { id } = await params;
  const user = await getCurrentUser();
  const list = await getListForViewer(id, user?.id ?? null);

  // Not found and not allowed look identical: otherwise a 403 would confirm
  // that a private list exists.
  if (!list) notFound();

  const isOwner = list.owner.id === user?.id;
  const gifts = list.gifts ?? [];
  const occasion = distinctOccasion(list.name, list.occasion);

  return (
    <>
      {/* Absent on your own list — the absence is the signal. */}
      <ViewpointBanner
        relation={isOwner ? 'owner' : 'friend'}
        person={list.owner}
        what="la liste"
      />

      <PageHeader
        title={list.name}
        subtitle={
          isOwner ? (
            // Same rule as the list index: the occasion is only worth a line
            // when it is not simply the title again.
            occasion
          ) : (
            <>
              Liste de {list.owner.name}
              {occasion ? ` · ${occasion}` : ''}
            </>
          )
        }
        back={
          isOwner
            ? { href: '/lists', label: t('lists.title') }
            : { href: `/u/${list.owner.id}`, label: list.owner.name }
        }
        actions={
          isOwner && (
            <>
              <ButtonLink href={`/lists/${id}/gifts/new`}>
                <PlusIcon size={18} />
                {t('action.add')}
              </ButtonLink>
              <ButtonLink href={`/lists/${id}/edit`} variant="secondary">
                {t('action.edit')}
              </ButtonLink>
            </>
          )
        }
      />

      <p className={styles.summary}>
        {t('common.wishes', { count: gifts.length })}
        {/*
          Only a friend sees how many are spoken for. Telling the owner
          "2 réservées" gives away most of the surprise without naming anybody.

          Set in ochre, like every other thing the owner cannot see.
        */}
        {list.reservedCount !== undefined && list.reservedCount > 0 && (
          <span className={styles.reserved}>
            {' · '}
            {t('common.reserved', { count: list.reservedCount })}
          </span>
        )}
      </p>

      {/* The fastest way in: a link or a few words, no form. Owners only —
          a friend has no business writing onto somebody else's list. */}
      {isOwner && <QuickAdd listId={id} />}

      {gifts.length === 0 ? (
        <EmptyState
          icon={<GiftIcon size={24} />}
          title={t('lists.emptyListTitle')}
          body={
            isOwner
              ? t('lists.emptyListHint')
              : "Rien à offrir ici pour l'instant."
          }
          action={
            isOwner && (
              <ButtonLink href={`/lists/${id}/gifts/new`}>
                {t('gift.addTitle')}
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
                <Priority priority={gift.priority} compact t={t} />
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
                {gift.reservation?.state === 'open' && (
                  <Badge tone="solid">{t('gift.pot')}</Badge>
                )}
                {/*
                  gift.reservation is undefined for the owner — not "free",
                  undefined. There is nothing here to render for them.
                */}
                {gift.reservation?.state === 'mine' && (
                  <Badge tone="secret">{t('gift.reservedByYou')}</Badge>
                )}
                {gift.reservation?.state === 'taken' && (
                  <Badge tone="muted">{t('gift.alreadyReserved')}</Badge>
                )}
              </div>
            </CardLink>
          ))}
        </Grid>
      )}
    </>
  );
}
