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
import { db } from '@/lib/db';
import { daysUntilBirthday, formatBirthdayCountdown } from '@/lib/format';
import { friendIds } from '@/lib/relations';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import type { TFunction } from '@/lib/i18n/t';
import styles from './birthdays.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('birthdays.title') };
}

export default async function BirthdaysPage() {
  const t = await getT();
  const user = await requireUser();
  const friends = await friendIds(user.id);

  const people = await db.user.findMany({
    where: { id: { in: friends }, birthday: { not: null } },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      birthday: true,
      _count: { select: { lists: true } },
    },
  });

  // Birthdays keep their original year in the database, so ordering by the
  // next occurrence has to happen here rather than in SQL.
  const upcoming = people
    .map((p) => ({ ...p, days: daysUntilBirthday(p.birthday!) }))
    .sort((a, b) => a.days - b.days);

  const soon = upcoming.filter((p) => p.days <= 30);
  const later = upcoming.filter((p) => p.days > 30);

  return (
    <>
      <PageHeader
        title={t('birthdays.title')}
        subtitle={t('birthdays.subtitle')}
        back={{ href: '/app', label: 'Accueil' }}
      />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={24} />}
          title={t('birthdays.emptyTitle')}
          body={t('birthdays.emptyBody')}
          action={<ButtonLink href="/search">{t('birthdays.findPeople')}</ButtonLink>}
        />
      ) : (
        <>
          {soon.length > 0 && (
            <section className={styles.section}>
              <SectionTitle>{t('birthdays.thisMonth')}</SectionTitle>
              <Stack>
                {soon.map((person) => (
                  <PersonRow key={person.id} person={person} highlight t={t} />
                ))}
              </Stack>
            </section>
          )}

          {later.length > 0 && (
            <section className={styles.section}>
              <SectionTitle>{t('birthdays.later')}</SectionTitle>
              <Stack>
                {later.map((person) => (
                  <PersonRow key={person.id} person={person} t={t} />
                ))}
              </Stack>
            </section>
          )}
        </>
      )}
    </>
  );
}

function PersonRow({
  person,
  highlight,
  t,
}: {
  person: {
    id: string;
    name: string;
    avatarUrl: string | null;
    days: number;
    _count: { lists: number };
  };
  highlight?: boolean;
  /** Passed down: this runs below the page, which is where the request's
      translator is resolved. */
  t: TFunction;
}) {
  return (
    <CardLink href={`/u/${person.id}`} className={styles.row}>
      <Avatar
        name={person.name}
        url={person.avatarUrl}
        size={44}
      />
      <div className={styles.text}>
        <span className={styles.name}>{person.name}</span>
        <span className={styles.lists}>
          {t('common.lists', { count: person._count.lists })}
        </span>
      </div>
      <Badge tone={highlight ? 'accent' : 'neutral'}>
        {formatBirthdayCountdown(person.days, t)}
      </Badge>
    </CardLink>
  );
}
