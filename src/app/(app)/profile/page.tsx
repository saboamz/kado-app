import type { Metadata } from 'next';
import { Button, ButtonLink } from '@/components/Button';
import { Avatar, Badge, Card, SectionTitle, Stack } from '@/components/display';
import { Decoration } from '@/components/Decoration';
import { SettingsIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { logout } from '@/lib/auth-actions';
import { db } from '@/lib/db';
import { friendIds } from '@/lib/relations';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from './profile.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('profile.title') };
}

export default async function ProfilePage() {
  const t = await getT();
  const user = await requireUser();

  const [profile, friends, listCount, giftCount] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { interests: true, decorations: true },
    }),
    friendIds(user.id),
    db.giftList.count({ where: { ownerId: user.id } }),
    db.gift.count({ where: { list: { ownerId: user.id } } }),
  ]);

  const footer = profile.decorations.find((d) => d.slot === 'footer');

  return (
    <>
      <PageHeader
        title={t('profile.title')}
        actions={
          <ButtonLink href="/settings" variant="secondary">
            <SettingsIcon size={18} />
            Paramètres
          </ButtonLink>
        }
      />

      <Card className={styles.identity}>
        <Avatar
          name={profile.name}
          url={profile.avatarUrl}
          size={72}
        />
        <div className={styles.identityText}>
          <h2 className={styles.name}>{profile.name}</h2>
          <p className={styles.email}>{profile.email}</p>
          {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
        </div>
      </Card>

      <dl className={styles.stats}>
        <div>
          <dd>{listCount}</dd>
          <dt>{t('profile.lists')}</dt>
        </div>
        <div>
          <dd>{giftCount}</dd>
          <dt>{t('profile.wishes')}</dt>
        </div>
        <div>
          <dd>{friends.length}</dd>
          <dt>{t('profile.friends')}</dt>
        </div>
      </dl>

      {profile.interests.length > 0 && (
        <section className={styles.section}>
          <SectionTitle>{t('profile.interests')}</SectionTitle>
          <ul className={styles.interests}>
            {profile.interests.map((i) => (
              <li key={i.id}>
                <Badge>{i.label}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <Stack>
          <ButtonLink href="/friends" variant="secondary" block>
            {t('profile.friendsCount', { count: friends.length })}
          </ButtonLink>
          <ButtonLink href="/profile/edit" variant="secondary" block>
            {t('profile.editTitle')}
          </ButtonLink>
          <form action={logout}>
            <Button variant="danger" type="submit" block>
              Se déconnecter
            </Button>
          </form>
        </Stack>
      </section>

      {/*
        Your own decoration, in the same place a visitor sees it.
        
        Without this you would be choosing something you never look at, and
        the only way to check it was to open your public profile from another
        account.
      */}
      {footer && <Decoration decoration={footer} slot="footer" />}
    </>
  );
}
