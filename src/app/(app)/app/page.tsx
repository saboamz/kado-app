import type { Metadata } from 'next';
import { ButtonLink } from '@/components/Button';
import {
  Avatar,
  Badge,
  CardLink,
  EmptyState,
  Grid,
  SectionTitle,
  Stack,
} from '@/components/display';
import { GiftIcon, UsersIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/lib/db';
import {
  daysUntilBirthday,
  formatBirthdayCountdown,
  formatRelative,
} from '@/lib/format';
import { friendIds } from '@/lib/relations';
import { requireUser } from '@/lib/session';
import styles from './home.module.css';

export const metadata: Metadata = { title: 'Accueil' };

export default async function AppHomePage() {
  const user = await requireUser();
  const friends = await friendIds(user.id);

  const [myLists, upcoming, activity] = await Promise.all([
    db.giftList.findMany({
      where: { ownerId: user.id },
      include: { _count: { select: { gifts: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      take: 4,
    }),
    // Birthdays are stored with their original year, so ordering has to happen
    // in JavaScript on the day-of-year rather than in SQL on the date.
    db.user.findMany({
      where: { id: { in: friends }, birthday: { not: null } },
      select: { id: true, name: true, avatarColor: true, birthday: true },
    }),
    db.giftList.findMany({
      where: { ownerId: { in: friends } },
      include: {
        owner: { select: { id: true, name: true, avatarColor: true } },
        _count: { select: { gifts: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  const birthdays = upcoming
    .map((f) => ({ ...f, days: daysUntilBirthday(f.birthday!) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title={`Bonjour ${user.name.split(' ')[0]}`}
        subtitle="Vos listes, et ce que préparent vos proches."
      />

      {birthdays.length > 0 && (
        <section className={styles.section}>
          <SectionTitle>Anniversaires</SectionTitle>
          <ul className={styles.birthdays}>
            {birthdays.map((b) => (
              <li key={b.id}>
                <CardLink href={`/u/${b.id}`} plain className={styles.birthday}>
                  <Avatar name={b.name} color={b.avatarColor} size={40} />
                  <span className={styles.birthdayName}>{b.name}</span>
                  <span
                    className={styles.birthdayWhen}
                    data-soon={b.days <= 14 ? '' : undefined}
                  >
                    {formatBirthdayCountdown(b.days)}
                  </span>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <SectionTitle>Mes listes</SectionTitle>
          <ButtonLink href="/lists" variant="ghost">
            Tout voir
          </ButtonLink>
        </div>

        {myLists.length === 0 ? (
          <EmptyState
            icon={<GiftIcon size={24} />}
            title="Aucune liste pour l'instant"
            body="Créez une liste et ajoutez ce qui vous ferait plaisir. Vos proches sauront quoi offrir."
            action={<ButtonLink href="/lists/new">Créer une liste</ButtonLink>}
          />
        ) : (
          <Grid>
            {myLists.map((list) => (
              <CardLink key={list.id} href={`/lists/${list.id}`}>
                <div className={styles.listTop}>
                  <span className={styles.listName}>{list.name}</span>
                  {list.isDefault && <Badge>Par défaut</Badge>}
                </div>
                <span className={styles.listMeta}>
                  {list._count.gifts} envie{list._count.gifts > 1 ? 's' : ''}
                </span>
              </CardLink>
            ))}
          </Grid>
        )}
      </section>

      <section className={styles.section}>
        <SectionTitle>Chez vos proches</SectionTitle>
        {activity.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={24} />}
            title="Pas encore d'amis"
            body="Trouvez vos proches pour voir leurs listes et savoir quoi leur offrir."
            action={<ButtonLink href="/search">Chercher des amis</ButtonLink>}
          />
        ) : (
          <Stack>
            {activity.map((list) => (
              <CardLink key={list.id} href={`/lists/${list.id}`} plain>
                <div className={styles.activityRow}>
                  <Avatar
                    name={list.owner.name}
                    color={list.owner.avatarColor}
                    size={40}
                  />
                  <div className={styles.activityText}>
                    <p className={styles.activityTitle}>
                      <strong>{list.owner.name}</strong> · {list.name}
                    </p>
                    <p className={styles.activityMeta}>
                      {list._count.gifts} envie
                      {list._count.gifts > 1 ? 's' : ''} ·{' '}
                      {formatRelative(list.updatedAt)}
                    </p>
                  </div>
                </div>
              </CardLink>
            ))}
          </Stack>
        )}
      </section>
    </>
  );
}
