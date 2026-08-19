import type { Metadata } from 'next';
import { ButtonLink } from '@/components/Button';
import {
  Avatar,
  Badge,
  CardLink,
  EmptyState,
  SectionTitle,
  Stack,
} from '@/components/display';
import { UsersIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { formatDateCountdown } from '@/lib/format';
import { upcomingForFriends, type LifeEventView } from '@/lib/life-events';
import { friendIds } from '@/lib/relations';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import type { TFunction } from '@/lib/i18n/t';
import styles from './events.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('events.title') };
}

type Row = LifeEventView & {
  owner: { id: string; name: string; avatarUrl: string | null };
};

export default async function EventsPage() {
  const t = await getT();
  const user = await requireUser();
  const friends = await friendIds(user.id);

  const upcoming = await upcomingForFriends(friends);

  const soon = upcoming.filter((e) => e.days <= 30);
  const later = upcoming.filter((e) => e.days > 30);

  return (
    <>
      <PageHeader
        title={t('events.title')}
        subtitle={t('events.subtitle')}
        back={{ href: '/app', label: 'Accueil' }}
      />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={24} />}
          title={t('events.emptyTitle')}
          body={t('events.emptyBody')}
          action={<ButtonLink href="/search">{t('events.findPeople')}</ButtonLink>}
        />
      ) : (
        <>
          {soon.length > 0 && (
            <section className={styles.section}>
              <SectionTitle>{t('events.thisMonth')}</SectionTitle>
              <Stack>
                {soon.map((event) => (
                  <EventRow key={event.id} event={event} highlight t={t} />
                ))}
              </Stack>
            </section>
          )}

          {later.length > 0 && (
            <section className={styles.section}>
              <SectionTitle>{t('events.later')}</SectionTitle>
              <Stack>
                {later.map((event) => (
                  <EventRow key={event.id} event={event} t={t} />
                ))}
              </Stack>
            </section>
          )}
        </>
      )}
    </>
  );
}

function EventRow({
  event,
  highlight,
  t,
}: {
  event: Row;
  highlight?: boolean;
  /** Passed down: this runs below the page, which is where the request's
      translator is resolved. */
  t: TFunction;
}) {
  return (
    <CardLink href={`/u/${event.owner.id}`} className={styles.row}>
      <Avatar name={event.owner.name} url={event.owner.avatarUrl} size={44} />
      <div className={styles.text}>
        <span className={styles.name}>{event.owner.name}</span>
        {/* The label is the person's own words, so it carries the meaning
            here rather than a category the app invented. */}
        <span className={styles.lists}>{event.label}</span>
      </div>
      <Badge tone={highlight ? 'accent' : 'neutral'}>
        {formatDateCountdown(event.days, t)}
      </Badge>
    </CardLink>
  );
}
