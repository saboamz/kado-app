import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/Button';
import { Badge, Card, Priority } from '@/components/display';
import { LiveRefresh } from '@/components/LiveRefresh';
import { PageHeader } from '@/components/PageHeader';
import { SecretSeal, SecretZone } from '@/components/SecretSeal';
import { UploadedImage } from '@/components/UploadedImage';
import { ViewpointBanner } from '@/components/Viewpoint';
import { Pot } from '@/components/Pot';
import { SecretChat } from '@/components/SecretChat';
import { ReserveButton } from '@/components/ReserveButton';
import { ReportButton } from '@/components/ReportButton';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/format';
import { canViewList, relationTo } from '@/lib/relations';
import { getChatForViewer } from '@/lib/chat';
import { giftInclude, viewGift } from '@/lib/secrecy';
import { getCurrentUser } from '@/lib/session';
import { categoryName } from '@/lib/i18n/categories';
import { getLocale, getT } from '@/lib/i18n/server';
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
  const t = await getT();
  const locale = await getLocale();
  const { id } = await params;
  const viewer = await getCurrentUser();
  const viewerId = viewer?.id ?? null;

  const owning = await db.gift.findUnique({
    where: { id },
    select: {
      /* Whether the link ever resolved to a catalogue row. Selected here
         rather than derived from the view, because a product can be joined
         and still carry no price — the two are different questions. */
      productId: true,
      list: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          visibility: true,
          // For the viewpoint banner. This is the list's OWNER — public
          // profile data, nothing to do with who reserved anything.
          owner: { select: { name: true, avatarUrl: true } },
        },
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

  // Null for an owner or a stranger: they are shown no room at all, rather
  // than an empty one that would betray the room's existence.
  const chat = viewerId ? await getChatForViewer(id, viewerId) : null;

  // Is there anything to put in the ochre zone? Each of these is already
  // absent for an owner by construction — this only decides whether to draw
  // the container, never what may go in it.
  const hasSecretZone = Boolean(gift.reservation || gift.pot || chat);
  const ownerFirstName =
    owning.list.owner.name.trim().split(/\s+/)[0] ?? owning.list.owner.name;

  /* A figure nobody typed. Shown differently, and never silently. */
  const estimated =
    gift.priceCents == null && gift.estimatedPriceCents != null;

  /*
   * A link we could not read, said out loud.
   *
   * The resolver fails silently by design — a shop refusing robots must not
   * cost somebody their wish — but silence left the owner with no way to know
   * why their wish had no price or picture. Shown only to them: it is about
   * their own link, and a friend can do nothing with it.
   */
  const linkUnread =
    relation === 'owner' && Boolean(gift.url) && !owning.productId;

  return (
    <>
      {/* Absent for an owner — that absence is the signal. */}
      <ViewpointBanner
        relation={relation}
        person={owning.list.owner}
        what="un cadeau"
      />

      <PageHeader
        title={gift.name}
        back={{ href: `/lists/${owning.list.id}`, label: owning.list.name }}
        actions={
          isOwner && (
            <ButtonLink href={`/gifts/${id}/edit`} variant="secondary">
              {t('action.edit')}
            </ButtonLink>
          )
        }
      />

      {gift.imageUrl && (
        <UploadedImage src={gift.imageUrl} className={styles.photo} />
      )}

      <div className={styles.headline}>
        <span className={styles.price} data-estimated={estimated ? '' : undefined}>
          {estimated
            ? t('gift.estimatedPrice', {
                price: formatMoney(gift.estimatedPriceCents!, gift.currency, locale),
              })
            : formatMoney(gift.priceCents, gift.currency, locale)}
        </span>
        <Priority priority={gift.priority} t={t} />
      </div>

      {/* Labelled, always. An unmarked guess is worse than no figure at all:
          somebody budgets against it and finds out at the till. */}
      {linkUnread && (
        <p className={styles.estimateNote}>{t('gift.linkUnread')}</p>
      )}

      {estimated && (
        <p className={styles.estimateNote}>
          {/* Addressed to whoever is reading: naming the owner on their own
              page talks about them in the third person. */}
          {relation === 'owner'
            ? t('gift.estimatedNoteOwn')
            : t('gift.estimatedNote', { name: ownerFirstName })}
        </p>
      )}

      <div className={styles.flags}>
        {gift.category && <Badge>{categoryName(gift.category, locale)}</Badge>}
        {gift.reservation?.state === 'mine' && (
          <Badge tone="secret">Vous l&rsquo;avez réservé</Badge>
        )}
        {gift.reservation?.state === 'open' && (
          <Badge tone="solid">{t('gift.sharedGift')}</Badge>
        )}
        {gift.reservation?.state === 'taken' && (
          <Badge tone="muted">{t('gift.alreadyReserved')}</Badge>
        )}
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
        Everything below is gathered into one ochre zone: the design's rule is
        that what the owner cannot see lives in a single region rather than
        scattered down the page, so a friend reads the boundary once.

        The zone is rendered only when there is something in it, and every
        piece inside is already owner-proof on its own: gift.reservation and
        gift.pot are undefined for an owner (secrecy.ts never builds them) and
        chat is null. `hasSecretZone` is a rendering convenience, never the
        thing that enforces the rule.
      */}
      {hasSecretZone && (
        <SecretZone>
          <SecretSeal title={t('gift.friendsSide')}>
            {gift.pot
              ? t('gift.potHiddenFromOwner', { name: ownerFirstName })
              : gift.reservation?.state === 'free'
                ? t('gift.hiddenIfYouReserve')
                : t('gift.ownerSeesNothing')}
          </SecretSeal>

          {gift.reservation && (
            <ReserveButton
              giftId={id}
              reservation={gift.reservation}
              /* The price if its author gave one, else what the shop said.
                 Only a suggestion until the opener confirms it. */
              suggestedGoal={gift.priceCents ?? gift.estimatedPriceCents}
            />
          )}

          {gift.pot && <Pot giftId={id} pot={gift.pot} />}

          {chat && <SecretChat giftId={id} messages={chat} />}

          {/*
            Live only where something can arrive from somebody else.
            
            A pot gains contributions and a chat gains messages; the rest of
            this page changes only when its owner edits the wish, and polling
            for that would be spend with nothing to show. Four seconds when a
            conversation is on screen, ten when it is only the pot — a reply
            arriving four seconds late still reads as a reply.
          */}
          <LiveRefresh intervalMs={chat ? 4_000 : 10_000} />
        </SecretZone>
      )}

      {/*
        For the owner it is literally true of this page: no reservation data
        was fetched to render it.
      */}
      {isOwner && (
        <div className={styles.guarantee}>
          {/* One string, not JSX text across two lines: a line break renders
              as a space mid-sentence. The apostrophe is the straight one this
              sentence has always used. */}
          <SecretSeal tone="guarantee">
            {"Vue propriétaire : aucune information de réservation n'existe sur cette page."}
          </SecretSeal>
        </div>
      )}
      {relation !== 'owner' && (
        <div className={styles.report}>
          <ReportButton giftId={id} />
        </div>
      )}
    </>
  );
}
