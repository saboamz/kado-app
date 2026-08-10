import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Avatar,
  Badge,
  CardLink,
  EmptyState,
  Grid,
  SectionTitle,
} from '@/components/display';
import { GiftIcon } from '@/components/icons';
import { Decoration } from '@/components/Decoration';
import { PageHeader } from '@/components/PageHeader';
import { ViewpointBanner } from '@/components/Viewpoint';
import { ReportButton } from '@/components/ReportButton';
import { db } from '@/lib/db';
import {
  daysUntilBirthday,
  formatBirthdayCountdown,
} from '@/lib/format';
import { getListsForViewer } from '@/lib/gifts';
import { relationTo } from '@/lib/relations';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from './person.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const person = await db.user.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: person?.name ?? 'Profil' };
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const viewer = await requireUser();

  // Your own profile lives at /profile, where the account actions are.
  if (id === viewer.id) {
    const { redirect } = await import('next/navigation');
    redirect('/profile');
  }

  const person = await db.user.findUnique({
    where: { id },
    include: { interests: true, decorations: true },
  });
  if (!person) notFound();

  const relation = await relationTo(viewer.id, person.id);
  // A stranger sees only what the person made public.
  const lists = await getListsForViewer(person.id, viewer.id);

  if (relation === 'stranger' && !person.profilePublic && lists.length === 0) {
    notFound();
  }

  const days = person.birthday ? daysUntilBirthday(person.birthday) : null;
  // Keyed by slot, so each place on the page asks for its own.
  const decor = Object.fromEntries(person.decorations.map((d) => [d.slot, d]));

  return (
    <>
      {/* You are never the owner here: /u/<your id> redirects to /profile. */}
      <ViewpointBanner
        relation={relation}
        person={person}
        what="le profil"
      />

      <PageHeader title={person.name} back={{ href: '/app', label: 'Accueil' }} />

      <div className={styles.identity}>
        <Avatar
          name={person.name}
          url={person.avatarUrl}
          size={64}
        />
        <div>
          {person.bio && <p className={styles.bio}>{person.bio}</p>}
          {days !== null && (
            <p className={styles.birthday}>
              Anniversaire {formatBirthdayCountdown(days, t)}
            </p>
          )}
        </div>
      </div>

      {person.interests.length > 0 && (
        <div className={styles.interests}>
          {person.interests.map((i) => (
            <Badge key={i.id}>{i.label}</Badge>
          ))}
        </div>
      )}

      <SectionTitle>{t('lists.theirLists')}</SectionTitle>
      {lists.length === 0 ? (
        <EmptyState
          icon={<GiftIcon size={24} />}
          title={t('lists.noVisibleLists')}
          body={
            relation === 'friend'
              ? t('profile.noListsToShare')
              : 'Devenez amis pour voir ses listes.'
          }
        />
      ) : (
        <Grid>
          {lists.map((list) => (
            <CardLink key={list.id} href={`/lists/${list.id}`}>
              <span className={styles.listName}>{list.name}</span>
              <span className={styles.listMeta}>
                {t('common.wishes', { count: list.giftCount })}
                {list.reservedCount !== undefined && list.reservedCount > 0 && (
                  <> · {t('common.reserved', { count: list.reservedCount })}</>
                )}
              </span>
            </CardLink>
          ))}
        </Grid>
      )}

      {decor.footer && (
        <Decoration decoration={decor.footer} slot="footer" />
      )}
      {/* Under the profile, and only for somebody else's: reporting your own
          avatar is not a thing. */}
      {relation !== 'owner' && (
        <div className={styles.report}>
          <ReportButton subjectId={person.id} />
        </div>
      )}
    </>
  );
}
