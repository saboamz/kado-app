import type { Metadata } from 'next';
import { ButtonLink } from '@/components/Button';
import { EmptyState, SectionTitle, Stack } from '@/components/display';
import { UsersIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { InviteLink } from '@/components/InviteLink';
import { PersonCard } from '@/components/PersonCard';
import { getOrCreateInvite } from '@/lib/invite-actions';
import { getFriendGroups } from '@/lib/people';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from './friends.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('friends.title') };
}

export default async function FriendsPage() {
  const t = await getT();
  const user = await requireUser();
  const { friends, received, sent } = await getFriendGroups(user.id);
  const invite = await getOrCreateInvite();

  return (
    <>
      <PageHeader
        title={t('friends.title')}
        subtitle={t('friends.subtitle')}
        actions={
          <ButtonLink href="/search" variant="secondary">
            Trouver quelqu&rsquo;un
          </ButtonLink>
        }
      />

      <InviteLink code={invite.code} uses={invite.uses} />

      {received.length > 0 && (
        <section className={styles.section}>
          <SectionTitle>
            Demandes reçues ({received.length})
          </SectionTitle>
          <Stack>
            {received.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </Stack>
        </section>
      )}

      <section className={styles.section}>
        <SectionTitle>Amis ({friends.length})</SectionTitle>
        {friends.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={24} />}
            title={t('home.noFriendsTitle')}
            body={t('friends.emptyBody')}
            action={<ButtonLink href="/search">{t('friends.find')}</ButtonLink>}
          />
        ) : (
          <Stack>
            {friends.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </Stack>
        )}
      </section>

      {sent.length > 0 && (
        <section className={styles.section}>
          <SectionTitle>Demandes envoyées ({sent.length})</SectionTitle>
          <Stack>
            {sent.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </Stack>
        </section>
      )}
    </>
  );
}
