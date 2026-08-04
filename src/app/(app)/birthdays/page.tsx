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
import styles from './birthdays.module.css';

export const metadata: Metadata = { title: 'Anniversaires' };

export default async function BirthdaysPage() {
  const user = await requireUser();
  const friends = await friendIds(user.id);

  const people = await db.user.findMany({
    where: { id: { in: friends }, birthday: { not: null } },
    select: {
      id: true,
      name: true,
      avatarColor: true,
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
        title="Anniversaires"
        subtitle="Qui fête quoi, et quand — pour ne plus jamais s'y prendre trop tard."
        back={{ href: '/app', label: 'Accueil' }}
      />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={24} />}
          title="Aucun anniversaire connu"
          body="Vos amis n'ont pas renseigné leur date de naissance, ou vous n'avez pas encore d'amis."
          action={<ButtonLink href="/search">Trouver des proches</ButtonLink>}
        />
      ) : (
        <>
          {soon.length > 0 && (
            <section className={styles.section}>
              <SectionTitle>Dans le mois</SectionTitle>
              <Stack>
                {soon.map((person) => (
                  <PersonRow key={person.id} person={person} highlight />
                ))}
              </Stack>
            </section>
          )}

          {later.length > 0 && (
            <section className={styles.section}>
              <SectionTitle>Plus tard</SectionTitle>
              <Stack>
                {later.map((person) => (
                  <PersonRow key={person.id} person={person} />
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
}: {
  person: {
    id: string;
    name: string;
    avatarColor: string;
    avatarUrl: string | null;
    days: number;
    _count: { lists: number };
  };
  highlight?: boolean;
}) {
  return (
    <CardLink href={`/u/${person.id}`} className={styles.row}>
      <Avatar
        name={person.name}
        color={person.avatarColor}
        url={person.avatarUrl}
        size={44}
      />
      <div className={styles.text}>
        <span className={styles.name}>{person.name}</span>
        <span className={styles.lists}>
          {person._count.lists} liste{person._count.lists > 1 ? 's' : ''}
        </span>
      </div>
      <Badge tone={highlight ? 'accent' : 'neutral'}>
        {formatBirthdayCountdown(person.days)}
      </Badge>
    </CardLink>
  );
}
