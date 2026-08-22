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
import { OnboardingCard } from '@/components/OnboardingCard';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/lib/db';
import {
  formatDateCountdown,
  formatRelative,
} from '@/lib/format';
import { getT } from '@/lib/i18n/server';
import { getOnboarding } from '@/lib/onboarding';
import { upcomingForFriends } from '@/lib/life-events';
import { friendIds } from '@/lib/relations';
import { requireUser } from '@/lib/session';
import styles from './home.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('nav.home') };
}

export default async function AppHomePage() {
  const user = await requireUser();
  const t = await getT();
  const friends = await friendIds(user.id);

  const [onboarding, myLists, upcoming, activity] = await Promise.all([
    getOnboarding(user.id, t),
    db.giftList.findMany({
      where: { ownerId: user.id },
      include: { _count: { select: { gifts: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      take: 4,
    }),
    // Ordered by next occurrence, which an event's day and month cannot
    // express in SQL — see upcomingForFriends.
    upcomingForFriends(friends, 6),
    db.giftList.findMany({
      where: { ownerId: { in: friends } },
      include: {
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: { select: { gifts: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  return (
    <>
      <PageHeader
        title={t('home.greeting', { name: user.name.split(' ')[0] ?? user.name })}
        subtitle={t('home.subtitle')}
      />

      {/* Above everything: it is the only thing here that tells a newcomer
          what to do, and below the fold it would never be read. It returns
          null once the four steps are done or the card is dismissed. */}
      {onboarding && (
        <OnboardingCard
          onboarding={onboarding}
          labels={{
            title: t('onboarding.title'),
            progress: t('onboarding.progress', {
              done: onboarding.doneCount,
              total: onboarding.steps.length,
            }),
            dismiss: t('onboarding.dismiss'),
            done: t('onboarding.done'),
          }}
        />
      )}

      {upcoming.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <SectionTitle>{t('home.events')}</SectionTitle>
            <ButtonLink href="/events" variant="ghost">
              {t('common.seeAll')}
            </ButtonLink>
          </div>
          <ul className={styles.birthdays}>
            {upcoming.map((e) => (
              <li key={e.id}>
                <CardLink
                  href={`/u/${e.owner.id}`}
                  plain
                  className={styles.birthday}
                >
                  <Avatar name={e.owner.name} url={e.owner.avatarUrl} size={40} />
                  <span className={styles.birthdayName}>
                    {e.owner.name}
                    {/* The label is what its owner called it, so it is shown
                        as written rather than mapped onto a category. */}
                    <span className={styles.eventLabel}>{e.label}</span>
                  </span>
                  <span
                    className={styles.birthdayWhen}
                    data-soon={e.days <= 14 ? '' : undefined}
                  >
                    {formatDateCountdown(e.days, t)}
                  </span>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <SectionTitle>{t('home.myLists')}</SectionTitle>
          <ButtonLink href="/lists" variant="ghost">
            {t('common.seeAll')}
          </ButtonLink>
        </div>

        {myLists.length === 0 ? (
          <EmptyState
            icon={<GiftIcon size={24} />}
            title={t('home.noListsTitle')}
            body={t('home.noListsBody')}
            action={<ButtonLink href="/lists/new">{t('home.createList')}</ButtonLink>}
          />
        ) : (
          <Grid>
            {myLists.map((list) => (
              <CardLink key={list.id} href={`/lists/${list.id}`}>
                <div className={styles.listTop}>
                  <span className={styles.listName}>{list.name}</span>
                  {list.isDefault && <Badge>{t('common.default')}</Badge>}
                </div>
                <span className={styles.listMeta}>
                  {t('common.wishes', { count: list._count.gifts })}
                </span>
              </CardLink>
            ))}
          </Grid>
        )}
      </section>

      <section className={styles.section}>
        <SectionTitle>{t('home.aroundYou')}</SectionTitle>
        {activity.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={24} />}
            title={t('home.noFriendsTitle')}
            body={t('home.noFriendsBody')}
            /*
             * The invitation link, not search.
             *
             * Search only finds people already signed up, and it sat directly
             * under a checklist step telling the same person to send their
             * link — two instructions on one screen, of which only one works
             * for somebody whose friends are not here yet.
             */
            action={
              <ButtonLink href="/friends">{t('home.inviteFriends')}</ButtonLink>
            }
          />
        ) : (
          <Stack>
            {activity.map((list) => (
              <CardLink key={list.id} href={`/lists/${list.id}`} plain>
                <div className={styles.activityRow}>
                  <Avatar
                    name={list.owner.name}
                    url={list.owner.avatarUrl}
                    size={40}
                  />
                  <div className={styles.activityText}>
                    <p className={styles.activityTitle}>
                      <strong>{list.owner.name}</strong> · {list.name}
                    </p>
                    <p className={styles.activityMeta}>
                      {t('common.wishes', { count: list._count.gifts })} ·{' '}
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
